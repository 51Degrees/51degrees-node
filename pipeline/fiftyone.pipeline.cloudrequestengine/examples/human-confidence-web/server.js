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
 * page. It comes in two ways, and this demo shows both.
 *
 * 1. Passive. This server asks the cloud itself, sending the visitor's
 *    request headers and IP address. HumanConfidenceSource is Passive and
 *    HumanConfidence is a plain level, worked out from the request alone.
 *    The server asks for it rather than reading it from the page, because
 *    a level a browser sends can be forged.
 * 2. Active. The page loads the 51Degrees client script, which runs the
 *    browser tests and sends the answers to the cloud. When the script
 *    completes, HumanConfidenceSource is Active and HumanConfidence holds
 *    a sealed value the browser can't read or change.
 * 3. Redeem. The page hands the sealed value to this server, which calls
 *    hc/redeem with it and the account's License Key, and gets the true
 *    level back. A sealed value redeems once, within ten seconds. This
 *    server is the only party holding the License Key, which the browser
 *    never sees.
 *
 * Environment variables:
 *   _51DEGREES_RESOURCE_KEY    the Resource Key, required
 *   _51DEGREES_LICENSE_KEY     a License Key of the same account, required
 *                              to redeem
 *   _51DEGREES_CLOUD_ENDPOINT  the API base including the /api/v4/
 *                              segment, defaults to
 *                              https://cloud.51degrees.com/api/v4/
 *   PORT                       the port to listen on, defaults to 5151
 *
 * Node 18 or later (built-in fetch), with no 51Degrees package needed.
 */

const { createServer } = require('http');
const { readFileSync } = require('fs');
const { join } = require('path');

// Read per request, so an edit to the page shows on the next load.
const readPage = () => readFileSync(join(__dirname, 'page.html'), 'utf8');
const readCss = () => readFileSync(join(__dirname, 'examples-main.min.css'));

// A short limit on each call, so a slow cloud can't hang the demo.
const TIMEOUT_MS = 10000;

// The most the page may send to be redeemed.
const MAX_FORM_LENGTH = 100000;

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

/**
 * The text of an error, whatever was thrown. fetch wraps the cause of a
 * transport failure, and the cause is the useful part since fetch itself
 * only says that it failed, and anything else that is not an Error is
 * printed as it is.
 *
 * @param {any} error whatever was thrown
 * @returns {string} the message
 */
function messageOf (error) {
  if (error && error.cause && error.cause.message) {
    return error.cause.message;
  }
  if (error && error.message) {
    return error.message;
  }
  return String(error);
}

/**
 * The start of a body, short enough to show on the page.
 *
 * @param {string} text a response body
 * @returns {string} at most its first 200 characters
 */
function trim (text) {
  return text.length > 200 ? text.slice(0, 200) : text;
}

/**
 * A member of the cloud's answer, where it is there and is text.
 *
 * @param {any} parent the part of the answer that holds the member
 * @param {string} name the member's name
 * @returns {string|null} the text, or null
 */
function read (parent, name) {
  return parent !== null && typeof parent === 'object' &&
    typeof parent[name] === 'string'
    ? parent[name]
    : null;
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
 * Builds the three routes that call the cloud. The License Key is held
 * here and only here, so the browser never sees it.
 *
 * @param {object} settings the settings
 * @param {string} settings.resource the Resource Key
 * @param {string} settings.license a License Key of the same account, or
 * an empty string
 * @param {string} settings.api the API base, ending in one slash
 * @param {Function} [settings.fetch] the HTTP transport, defaulting to the
 * global fetch. Tests give one.
 * @returns {{check: Function, passive: Function, redeem: Function}} the
 * routes
 */
function demoRoutes ({ resource, license, api, fetch = globalThis.fetch }) {
  const call = (url, options) => fetch(url, Object.assign(
    { signal: AbortSignal.timeout(TIMEOUT_MS) }, options));

  // The request headers the cloud reads, from its own list, fetched once.
  // Only these are passed on, so headers such as Authorization stay here.
  let headerNames = null;
  const cloudHeaders = async () => {
    if (headerNames === null) {
      const answer = await call(api + 'evidencekeys');
      const body = await answer.text();
      if (!answer.ok) {
        throw new Error(`HTTP ${answer.status}: ${trim(body)}`);
      }
      const keys = JSON.parse(body);
      headerNames = new Set((Array.isArray(keys) ? keys : [])
        .filter((key) => /^header\./i.test(key))
        .map((key) => key.slice(7).toLowerCase()));
    }
    return headerNames;
  };

  return {
    /**
     * Before the flow: this server asks the cloud which properties the
     * Resource Key includes, and tells the page whether HumanConfidence
     * is one of them.
     *
     * @param {import('http').ServerResponse} response the response to
     * write
     */
    async check (response) {
      try {
        const answer = await call(api + 'accessibleproperties?resource=' +
          encodeURIComponent(resource));
        const body = await answer.text();
        if (!answer.ok) {
          sendJson(response, 200,
            { error: `HTTP ${answer.status}: ${trim(body)}` });
          return;
        }
        const products = Object.values(JSON.parse(body).Products || {});
        sendJson(response, 200, {
          humanConfidence: products.some((product) =>
            product !== null && typeof product === 'object' &&
            Array.isArray(product.Properties) &&
            product.Properties.some((property) =>
              String(property && property.Name).toLowerCase() ===
              'humanconfidence'))
        });
      } catch (error) {
        sendJson(response, 200, { error: messageOf(error) });
      }
    },

    /**
     * Passive: this server asks the cloud for the visitor, with the
     * visitor's headers and IP address, and reads the plain level from
     * the answer.
     *
     * @param {import('http').IncomingMessage} request the visitor's
     * request
     * @param {import('http').ServerResponse} response the response to
     * write
     */
    async passive (request, response) {
      try {
        const names = await cloudHeaders();
        const evidence = {};
        for (const [name, value] of Object.entries(request.headers)) {
          if (names.has(name.toLowerCase())) {
            evidence[name.toLowerCase()] = String(value);
          }
        }
        // Behind a load balancer or CDN, use the visitor's address it
        // passes on. Set last, so no header can replace it.
        const ip = request.socket && request.socket.remoteAddress;
        if (ip) {
          evidence['client-ip'] = ip.replace(
            /^::ffff:(?=\d+\.\d+\.\d+\.\d+$)/i, '');
        }
        const answer = await call(api + resource + '.json', {
          method: 'POST',
          body: new URLSearchParams(evidence)
        });
        const body = await answer.text();
        if (!answer.ok) {
          sendJson(response, 200,
            { error: `HTTP ${answer.status}: ${trim(body)}` });
          return;
        }
        const derived = JSON.parse(body).derived;
        sendJson(response, 200, {
          source: read(derived, 'humanconfidencesource'),
          humanConfidence: read(derived, 'humanconfidence')
        });
      } catch (error) {
        sendJson(response, 200, { error: messageOf(error) });
      }
    },

    /**
     * Redeem: the page sends the sealed value, and this server redeems it
     * with the License Key. The answer goes back to the page as the cloud
     * gave it.
     *
     * @param {string} value the sealed value from the page
     * @param {import('http').ServerResponse} response the response to
     * write
     */
    async redeem (value, response) {
      const fields = { value };
      if (license) {
        fields.license = license;
      }
      try {
        const answer = await call(api + 'hc/redeem', {
          method: 'POST',
          body: new URLSearchParams(fields)
        });
        const body = await answer.text();
        if (answer.status === 404) {
          sendJson(response, 200, {
            error: `The service at ${api} doesn't redeem Human Confidence.`
          });
          return;
        }
        response.writeHead(answer.status,
          { 'Content-Type': 'application/json' });
        response.end(body);
      } catch (error) {
        sendJson(response, 502, { error: messageOf(error) });
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
  const port = Number(process.env.PORT || 5151);
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
      'Passive and Active, but an account that holds License Keys can\'t ' +
      'redeem without one, so the redeemed level will be unreadable.');
  }

  // The API base ends in exactly one slash, so every URL is the base plus
  // a relative path. The page builds its own call from the same base.
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
      response.end(readPage()
        .replaceAll('__RESOURCE__', resource)
        .replaceAll('__API__', api));
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
    if (url.pathname === '/redeem' && request.method === 'POST') {
      const form = await readForm(request);
      if (form === null) {
        response.writeHead(413, { Connection: 'close' });
        response.end();
        return;
      }
      await routes.redeem(form.get('value') || '', response);
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

module.exports = { demoRoutes };

if (require.main === module) {
  main();
}
