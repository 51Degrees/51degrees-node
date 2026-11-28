/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

/**
 * Human Confidence demo server. Node's built-in http server. Run:
 *   node server.js    then open http://localhost:5151/
 *
 * Human Confidence says how likely it is that a person is looking at the
 * page. It comes in two ways, and this demo shows both. In both, this server
 * only reads two Properties, HumanConfidence and HumanConfidenceSource, from
 * the derived Element Data of a Pipeline that uses the cloud.
 *
 * 1. Passive. This server processes the visitor's request headers and IP
 *    address. HumanConfidenceSource is Passive and HumanConfidence is a
 *    plain level. The server reads it from its own Pipeline rather than
 *    from the page, because a level a browser sends can be forged.
 * 2. Active. The page loads the 51Degrees client script, which runs the
 *    browser tests and sends the answers to the cloud. When the script
 *    completes, HumanConfidenceSource is Active and HumanConfidence holds
 *    a sealed result the browser can't read or change.
 * 3. The page sends the sealed result to this server as the
 *    humanconfidence parameter, with its page id as humanconfidencepage.
 *    The Pipeline's Cloud Request Engine redeems it with the License Key
 *    and the transaction it kept for the page, and the server reads the
 *    two Properties again. A sealed result redeems once, within ten seconds, so
 *    sending it again gives Medium. The License Key stays on this server.
 *
 * Environment variables:
 *   _51DEGREES_RESOURCE_KEY    the Resource Key, required
 *   _51DEGREES_LICENSE_KEY     a License Key of the same account, required
 *                              to redeem
 *   _51DEGREES_CLOUD_ENDPOINT  the API base including the /api/v4/
 *                              segment, defaults to
 *                              https://cloud.51degrees.com/api/v4/
 *   _51DEGREES_EXAMPLE_HTTP_PORTS
 *                              the port to listen on, defaults to 5151
 *
 * A Flow Data must not be used by two threads at once, so this example
 * creates one for each request. Code that shares a Flow Data between tasks
 * is responsible for any locking.
 */

const { createServer } = require('http');
const { readFileSync } = require('fs');
const { join, resolve } = require('path');
const { PipelineBuilder } = require(
  resolve(__dirname, '../../../fiftyone.pipeline.core'));
// const { PipelineBuilder } = require('fiftyone.pipeline.core');
const { CloudRequestEngine, DerivedCloudEngine } = require(
  resolve(__dirname, '../..'));
// const { CloudRequestEngine, DerivedCloudEngine } =
//   require('fiftyone.pipeline.cloudrequestengine');

// Read per request, so an edit to the page shows on the next load.
const readPage = () => readFileSync(join(__dirname, 'page.html'), 'utf8');
const readCss = () => readFileSync(join(__dirname, 'examples-main.min.css'));

// The most the page may send.
const MAX_FORM_LENGTH = 100000;

// The two Properties the demo reads.
const PROPERTIES = ['derived.HumanConfidence', 'derived.HumanConfidenceSource'];

// Where to go next, printed when the demo ends with no Resource Key. The
// page holds the same links when the server runs.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tBots and humans: https://51degrees.com/bots-and-humans?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-human-confidence-web-server.js&utm_term=find-out-more-bots-and-humans',
  '\tThe cloud service: https://51degrees.com/documentation/_services__cloud__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-human-confidence-web-server.js&utm_term=find-out-more-cloud',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-human-confidence-web-server.js&utm_term=find-out-more-contact'
].join('\n');

// What the page is told when the Properties can't be read. The details go
// to this server's log instead, because an error's text can name a
// credential, and no page may receive any part of the License Key.
const READ_FAILED = 'The Properties could not be read. See the log on the server.';

/**
 * The text of an error, whatever was thrown. A Pipeline that fails gives
 * an AggregateError, whose errors say what went wrong.
 *
 * @param {any} error whatever was thrown
 * @returns {string} the message
 */
function messageOf (error) {
  if (error && Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map(messageOf).join(' ');
  }
  if (error && error.message) {
    return error.message;
  }
  return String(error);
}

/**
 * Logs an error on this server, with the License Key left out, and gives
 * what the page is told in its place.
 *
 * @param {any} error whatever was thrown
 * @param {string} license the License Key, or an empty string
 * @returns {{error: string}} the answer for the page
 */
function failed (error, license) {
  const text = messageOf(error);
  console.error('Human Confidence demo: ' +
    (license ? text.split(license).join('[hidden]') : text));
  return { error: READ_FAILED };
}

/**
 * Writes a JSON body with the given status.
 *
 * @param {import('http').ServerResponse} response the response to write
 * @param {number} status the HTTP status
 * @param {object} body the JSON body
 */
function sendJson (response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

/**
 * The value of a Property of the derived Element Data, or null where it
 * has none.
 *
 * @param {object} derived the derived Element Data
 * @param {string} name the Property's name
 * @returns {string|null} the value, or null
 */
function valueOf (derived, name) {
  try {
    const property = derived[name];
    return property && property.hasValue ? property.value : null;
  } catch (e) {
    return null;
  }
}

/**
 * Builds the routes. The License Key is held by the Pipeline here and only
 * here, so the browser never sees it.
 *
 * @param {object} settings the settings
 * @param {string} settings.resource the Resource Key
 * @param {string} settings.license a License Key of the same account, or
 * an empty string
 * @param {string} settings.api the API base, ending in one slash
 * @param {object} [settings.requestClient] the Cloud Request Engine's HTTP
 * client. Tests give one.
 * @returns {{page: Function, check: Function, passive: Function,
 * active: Function}} the routes
 */
function demoRoutes ({ resource, license, api, requestClient }) {
  const engine = new CloudRequestEngine({
    resourceKey: resource,
    licenseKey: license,
    requestedProperties: PROPERTIES,
    baseURL: api,
    requestClient
  });
  const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
    .add(engine)
    .add(new DerivedCloudEngine())
    .build();

  /**
   * Processes a Flow Data with the visitor's request headers the cloud
   * reads, the visitor's address and any more evidence, and reads the two
   * Properties.
   *
   * @param {import('http').IncomingMessage} request the visitor's request
   * @param {object} more more evidence
   * @returns {Promise<object>} the two Properties, or the error
   */
  const read = async (request, more) => {
    await engine.ready();
    const flowData = pipeline.createFlowData();
    // Only the headers the cloud reads are passed on, so headers such as
    // Authorization stay here.
    for (const [name, value] of Object.entries(request.headers)) {
      const key = 'header.' + name.toLowerCase();
      if (engine.evidenceKeyFilter.filterEvidenceKey(key)) {
        flowData.evidence.add(key, String(value));
      }
    }
    // Behind a load balancer or CDN, use the visitor's address it passes
    // on.
    const ip = request.socket && request.socket.remoteAddress;
    if (ip) {
      flowData.evidence.add('server.client-ip',
        ip.replace(/^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, ''));
    }
    for (const [key, value] of Object.entries(more)) {
      flowData.evidence.add(key, value);
    }
    let failure;
    await flowData.process().catch((error) => { failure = error; });
    const derived = flowData.tryGet('derived');
    if (derived === undefined) {
      return failed(failure, license);
    }
    return {
      source: valueOf(derived, 'humanconfidencesource'),
      humanConfidence: valueOf(derived, 'humanconfidence')
    };
  };

  return {
    /**
     * A new page: the engine gives it a page id and the address of the
     * client script, which carries the transaction it keeps for the page.
     *
     * @returns {{page: string, script: string}} the page id and the script
     * address
     */
    page () {
      return engine.newHumanConfidencePage();
    },

    /**
     * Before the flow: this server tells the page whether the Resource Key
     * includes HumanConfidence, from the properties the engine found.
     *
     * @param {import('http').ServerResponse} response the response to
     * write
     */
    async check (response) {
      try {
        await engine.ready();
        const derived = engine.flowElementProperties.derived || {};
        sendJson(response, 200, {
          humanConfidence: Object.keys(derived).includes('humanconfidence')
        });
      } catch (error) {
        sendJson(response, 200, failed(error, license));
      }
    },

    /**
     * Passive: the Pipeline processes the visitor's request, and this
     * server reads the two Properties.
     *
     * @param {import('http').IncomingMessage} request the visitor's
     * request
     * @param {import('http').ServerResponse} response the response to
     * write
     */
    async passive (request, response) {
      try {
        sendJson(response, 200, await read(request, {}));
      } catch (error) {
        sendJson(response, 200, failed(error, license));
      }
    },

    /**
     * Active: the page sends the sealed result and its page id, the
     * Pipeline processes them as the Evidence query.humanconfidence and
     * query.humanconfidencepage, and this server reads the two Properties.
     *
     * @param {import('http').IncomingMessage} request the visitor's
     * request
     * @param {string} sealed the sealed result the page sent
     * @param {string} page the page id the page sent
     * @param {import('http').ServerResponse} response the response to
     * write
     */
    async active (request, sealed, page, response) {
      try {
        sendJson(response, 200, await read(request, {
          'query.humanconfidence': sealed,
          'query.humanconfidencepage': page
        }));
      } catch (error) {
        sendJson(response, 200, failed(error, license));
      }
    }
  };
}

/**
 * The form a request posted.
 *
 * @param {import('http').IncomingMessage} request the request
 * @returns {Promise<URLSearchParams|null>} the form's fields, or null for
 * a form that is too long or could not be read
 */
function readForm (request) {
  return new Promise((resolve) => {
    let body = '';
    request.setEncoding('utf8');
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_FORM_LENGTH) {
        resolve(null);
      }
    });
    request.on('end', () => resolve(new URLSearchParams(body)));
    request.on('error', () => resolve(null));
  });
}

/**
 * Reads the environment and starts the server.
 */
function main () {
  const resource = (process.env._51DEGREES_RESOURCE_KEY || '').trim();
  const license = (process.env._51DEGREES_LICENSE_KEY || '').trim();
  const endpoint = (process.env._51DEGREES_CLOUD_ENDPOINT || '').trim();
  const port = Number(process.env._51DEGREES_EXAMPLE_HTTP_PORTS || 5151);
  if (!resource) {
    // With no Resource Key the demo has nothing to serve, so it says how
    // to get one and ends.
    console.log('Set _51DEGREES_RESOURCE_KEY to the Resource Key of the ' +
      'page. Resource Keys are created at ' +
      'https://51degrees.com/configure?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-examples-human-confidence-web-server.js&utm_term=resource-key-required');
    console.log(FIND_OUT_MORE);
    return;
  }
  if (!license) {
    console.log('No _51DEGREES_LICENSE_KEY set. The page still shows ' +
      'Passive and Active, but the Pipeline needs a License Key to redeem ' +
      'a sealed result, so after the browser tests HumanConfidence will ' +
      'be Medium.');
  }

  // The API base ends in exactly one slash, so every URL is the base plus
  // a relative path.
  const api = (endpoint || 'https://cloud.51degrees.com/api/v4/')
    .replace(/\/+$/, '') + '/';
  const routes = demoRoutes({ resource, license, api });

  createServer(async (request, response) => {
    const url = new URL(request.url, `http://${request.headers.host}`);
    if (url.pathname === '/') {
      // The page must never come from a cache, as each load runs the
      // tests.
      response.writeHead(200, {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store'
      });
      // Each load is a new page, with its own page id and transaction.
      const { page, script } = routes.page();
      response.end(readPage()
        .replaceAll('__SCRIPT__', script)
        .replaceAll('__PAGE__', page));
      return;
    }
    if (url.pathname === '/examples-main.min.css') {
      response.writeHead(200, { 'Content-Type': 'text/css' });
      response.end(readCss());
      return;
    }
    if (url.pathname === '/check') {
      await routes.check(response);
      return;
    }
    if (url.pathname === '/passive') {
      await routes.passive(request, response);
      return;
    }
    if (url.pathname === '/active' && request.method === 'POST') {
      const form = await readForm(request);
      if (form === null) {
        response.writeHead(413, { Connection: 'close' });
        response.end();
        return;
      }
      await routes.active(request, form.get('humanconfidence') || '',
        form.get('humanconfidencepage') || '', response);
      return;
    }
    response.writeHead(404);
    response.end();
  // Only the machine the example runs on, at 127.0.0.1 rather than
  // localhost, which can resolve to the IPv6 loopback alone.
  }).listen(port, '127.0.0.1', () =>
    console.log(
      `Human Confidence demo on http://localhost:${port}/, using ${api}`));
}

module.exports = { demoRoutes, READ_FAILED };

if (require.main === module) {
  main();
}
