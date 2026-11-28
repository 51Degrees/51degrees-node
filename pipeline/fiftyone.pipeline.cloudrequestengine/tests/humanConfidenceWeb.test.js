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
// The Human Confidence web example. Its three server routes are driven with
// a stand-in for the cloud service, given to the example's Cloud Request
// Engine, so no network is touched. The example only reads the two
// Properties from its Pipeline, and never redeems a sealed result itself.
//
// The example is then started as its own process, as a person starts it,
// to check the page it serves, the endpoint and port it reads, and what it
// prints with no resource key. Those tests call no cloud service either.

const { spawn, spawnSync } = require('child_process');
const fs = require('fs');
const http = require('http');
const net = require('net');
const path = require('path');

const FOLDER = path.join(__dirname, '..', 'examples', 'human-confidence-web');
const SERVER = path.join(FOLDER, 'server.js');
const {
  demoRoutes, READ_FAILED
} = require('../examples/human-confidence-web/server');

/**
 * Runs a function with console.error collected rather than printed.
 *
 * @param {Function} action the function, which may return a promise
 * @returns {Promise<Array<string>>} what was logged
 */
async function errorsLoggedBy (action) {
  const logged = [];
  const spy = jest.spyOn(console, 'error')
    .mockImplementation((...items) => logged.push(items.join(' ')));
  try {
    await action();
  } finally {
    spy.mockRestore();
  }
  return logged;
}

const API = 'https://cloud.example/api/v4/';
const RESOURCE = 'AQTestResourceKey';
const LICENSE = 'AQTestLicenseKey';
const SEALED = 'sealedResultNotReal_0123456789';

// What the cloud's accessibleproperties answers for a key, with the
// properties named under one product.
const accessible = (...names) => ({
  Products: {
    derived: {
      DataTier: 'CloudV5Pro',
      Properties: names.map((name) => ({ Name: name, Type: 'String' }))
    }
  }
});

// The evidence keys the stand-in lists. Only two are headers.
const KEYS = [
  'header.user-agent', 'header.Sec-CH-UA', 'query.user-agent',
  'server.client-ip'
];

/**
 * A stand-in for the Cloud Request Engine's HTTP client that records each
 * JSON call and answers it from a function.
 *
 * @param {object} options options
 * @param {function(object): object} [options.json] given the JSON call's
 * content, returns the answer, or throws to fail the call
 * @param {object} [options.properties] the accessible properties answer
 * @param {*} [options.failure] what every request rejects with
 * @returns {object} the stand-in, with the calls made in its calls member
 */
function cloudAnswering ({
  json = () => ({}),
  properties = accessible('HumanConfidence', 'HumanConfidenceSource'),
  failure
} = {}) {
  const client = {
    calls: [],
    get (url) {
      if (failure !== undefined) return Promise.reject(failure);
      return Promise.resolve(JSON.stringify(
        url.includes('evidencekeys') ? KEYS : properties));
    },
    post (url, content) {
      if (failure !== undefined) return Promise.reject(failure);
      if (url.includes('accessibleproperties')) {
        return Promise.resolve(JSON.stringify(properties));
      }
      client.calls.push({ url, content: Object.assign({}, content) });
      try {
        return Promise.resolve(JSON.stringify(json(content)));
      } catch (error) {
        return Promise.reject(error);
      }
    }
  };
  return client;
}

/**
 * A stand-in for an HTTP response that records the status, headers and body
 * written to it.
 *
 * @returns {object} the response stand-in
 */
function fakeResponse () {
  return {
    status: null,
    headers: null,
    body: '',
    writeHead (status, headers) {
      this.status = status;
      this.headers = headers || {};
    },
    end (body) {
      this.body = body === undefined ? '' : String(body);
    }
  };
}

const routesWith = (requestClient, license = LICENSE) =>
  demoRoutes({ resource: RESOURCE, license, api: API, requestClient });

// A failure with no answer from the cloud service.
const UNREACHABLE = { headers: {}, content: 'connect ECONNREFUSED' };

const visitor = (remoteAddress = '203.0.113.7') => ({
  headers: {
    'user-agent': 'Mozilla/5.0 (test)',
    'sec-ch-ua': '"Chromium";v="140"',
    authorization: 'Bearer secret',
    cookie: 'session=1',
    'client-ip': '198.51.100.1'
  },
  socket: { remoteAddress }
});

describe('Human Confidence example /check route', () => {
  test('a key that carries HumanConfidence is reported as carrying it',
    async () => {
      const response = fakeResponse();
      await routesWith(cloudAnswering()).check(response);

      expect(response.status).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual({ humanConfidence: true });
    });

  test('a key that does not carry it is reported as not carrying it',
    async () => {
      const response = fakeResponse();
      await routesWith(cloudAnswering({ properties: accessible('IsMobile') }))
        .check(response);
      expect(JSON.parse(response.body)).toEqual({ humanConfidence: false });
    });

  test('an unreachable cloud is logged, and the page is told to look there',
    async () => {
      const response = fakeResponse();
      const logged = await errorsLoggedBy(() =>
        routesWith(cloudAnswering({ failure: UNREACHABLE })).check(response));
      expect(JSON.parse(response.body)).toEqual({ error: READ_FAILED });
      expect(logged.join('\n')).toContain('ECONNREFUSED');
    });
});

describe('Human Confidence example /passive route', () => {
  test('passes on the headers the cloud lists and the address, and ' +
    'answers with the two Properties', async () => {
    const cloud = cloudAnswering({
      json: () => ({
        derived: { humanconfidence: 'Medium', humanconfidencesource: 'Passive' }
      })
    });
    const response = fakeResponse();
    await routesWith(cloud).passive(visitor(), response);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body))
      .toEqual({ source: 'Passive', humanConfidence: 'Medium' });
    expect(cloud.calls).toHaveLength(1);
    expect(cloud.calls[0].url).toBe(API + RESOURCE + '.json');
    const content = cloud.calls[0].content;
    expect(content['user-agent']).toBe('Mozilla/5.0 (test)');
    expect(content['sec-ch-ua']).toBe('"Chromium";v="140"');
    expect(content['client-ip']).toBe('203.0.113.7');
    expect(JSON.stringify(content)).not.toContain('Bearer secret');
    expect(JSON.stringify(content)).not.toContain('session=1');
    expect(content.humanconfidence).toBeUndefined();
  });

  test('sends an IPv4 address mapped to IPv6 as IPv4', async () => {
    const cloud = cloudAnswering({ json: () => ({ derived: {} }) });
    await routesWith(cloud)
      .passive(visitor('::ffff:203.0.113.7'), fakeResponse());
    expect(cloud.calls[0].content['client-ip']).toBe('203.0.113.7');
  });

  test('an answer without the properties gives neither', async () => {
    const cloud = cloudAnswering({ json: () => ({ derived: {} }) });
    const response = fakeResponse();
    await routesWith(cloud).passive(visitor(), response);
    expect(JSON.parse(response.body))
      .toEqual({ source: null, humanConfidence: null });
  });

  // A key outside the Bespoke product is answered with no source, with or
  // without a level. The route gives what the Pipeline gave and makes up
  // neither.
  test.each([null, 'Medium'])(
    'an answer for a key outside Bespoke gives no source (level %p)',
    async (level) => {
      const derived = {
        humanconfidence: level,
        humanconfidencesource: null,
        humanconfidencesourcenullreason:
          'The key does not give this property a value.'
      };
      if (level === null) {
        derived.humanconfidencenullreason =
          'The key does not give this property a value.';
      }
      const cloud = cloudAnswering({ json: () => ({ derived }) });
      const response = fakeResponse();
      await routesWith(cloud).passive(visitor(), response);
      expect(JSON.parse(response.body))
        .toEqual({ source: null, humanConfidence: level });
    });

  test('a cloud failure is logged, and the page is told to look there',
    async () => {
      const cloud = cloudAnswering({
        json: () => {
          throw Object.assign(new Error('Forbidden'),
            { statusCode: 403, headers: {}, content: 'Forbidden' });
        }
      });
      const response = fakeResponse();
      const logged = await errorsLoggedBy(() =>
        routesWith(cloud).passive(visitor(), response));
      expect(JSON.parse(response.body)).toEqual({ error: READ_FAILED });
      expect(logged.join('\n')).toContain('403');
    });

  test.each(['check', 'passive', 'active'])(
    'no part of a License Key the cloud names reaches the page or the log, ' +
    'on %s', async (route) => {
      const key = 'LK0123456789WXYZ';
      const parts = Array.from({ length: key.length - 3 },
        (unused, i) => key.slice(i, i + 4));
      const refusal = {
        statusCode: 403,
        headers: {},
        content: JSON.stringify({ errors: [`The key ${key} is not valid.`] })
      };
      const routes = routesWith(cloudAnswering({ failure: refusal }), key);
      const response = fakeResponse();
      const logged = await errorsLoggedBy(() => route === 'check'
        ? routes.check(response)
        : route === 'passive'
          ? routes.passive(visitor(), response)
          : routes.active(visitor(), SEALED, 'aPage', response));

      expect(JSON.parse(response.body)).toEqual({ error: READ_FAILED });
      expect(logged.length).toBeGreaterThan(0);
      const text = response.body + '\n' + logged.join('\n');
      expect(parts.filter((part) => text.includes(part))).toEqual([]);
    });
});

describe('Human Confidence example /active route', () => {
  // The answer the cloud service gives a JSON call, High where the call
  // holds the sealed result with the transaction the page was given.
  const redeeming = (transaction) => (content) => {
    const redeems = content.humanconfidence === SEALED &&
      content.transaction === transaction();
    return {
      derived: {
        humanconfidence: redeems ? 'High' : 'Medium',
        humanconfidencesource: 'Active'
      }
    };
  };

  /**
   * A new page from the routes, with the transaction its script address
   * carries.
   *
   * @param {object} routes the routes
   * @returns {{page: string, script: string, transaction: string}} the page
   */
  const newPage = (routes) => {
    const page = routes.page();
    return Object.assign(page,
      { transaction: new URL(page.script).searchParams.get('transaction') });
  };

  test('gives each page an id and a script address with its transaction',
    () => {
      const routes = routesWith(cloudAnswering());
      const first = newPage(routes);
      const second = newPage(routes);
      expect(first.script.startsWith(API + RESOURCE + '.js?transaction='))
        .toBe(true);
      expect(first.page).not.toBe(second.page);
      expect(first.transaction).not.toBe(second.transaction);
      expect(first.script).not.toContain(first.page);
    });

  test('gives the sealed result and the page id to its Pipeline and ' +
    'answers with the two Properties the Pipeline gives', async () => {
    const page = {};
    const cloud = cloudAnswering({ json: redeeming(() => page.transaction) });
    const routes = routesWith(cloud);
    Object.assign(page, newPage(routes));
    const response = fakeResponse();
    await routes.active(visitor(), SEALED, page.page, response);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body))
      .toEqual({ source: 'Active', humanConfidence: 'High' });
    // Redeemed in the Pipeline's own JSON call, with the License Key and
    // the page's transaction, and through nothing else.
    expect(cloud.calls).toHaveLength(1);
    expect(cloud.calls[0].url).toBe(API + RESOURCE + '.json');
    expect(cloud.calls[0].content).toMatchObject({
      humanconfidence: SEALED, transaction: page.transaction, license: LICENSE
    });
    expect(cloud.calls[0].content.humanconfidencepage).toBeUndefined();
  });

  test('a sealed result sent again for the same page is Medium, and is ' +
    'not sent to the cloud again', async () => {
    const page = {};
    const cloud = cloudAnswering({ json: redeeming(() => page.transaction) });
    const routes = routesWith(cloud);
    Object.assign(page, newPage(routes));
    await routes.active(visitor(), SEALED, page.page, fakeResponse());
    const second = fakeResponse();
    await routes.active(visitor(), SEALED, page.page, second);
    expect(JSON.parse(second.body))
      .toEqual({ source: 'Active', humanConfidence: 'Medium' });
    expect(cloud.calls).toHaveLength(2);
    expect(cloud.calls[1].content.humanconfidence).toBeUndefined();
  });

  test('a page id the server did not give is Medium, and the sealed ' +
    'result is not sent', async () => {
    const cloud = cloudAnswering({ json: redeeming(() => undefined) });
    const response = fakeResponse();
    await routesWith(cloud).active(visitor(), SEALED, 'notAPage', response);
    expect(JSON.parse(response.body))
      .toEqual({ source: 'Active', humanConfidence: 'Medium' });
    expect(cloud.calls[0].content.humanconfidence).toBeUndefined();
  });

  test('with no license key the sealed result is not redeemed, and the ' +
    'level is Medium', async () => {
    const cloud = cloudAnswering({
      json: () => ({ derived: { humanconfidence: 'High' } })
    });
    const routes = routesWith(cloud, '');
    const response = fakeResponse();
    await routes.active(visitor(), SEALED, newPage(routes).page, response);
    expect(JSON.parse(response.body))
      .toEqual({ source: 'Active', humanConfidence: 'Medium' });
    expect(cloud.calls[0].content.humanconfidence).toBeUndefined();
  });

  test('a cloud that fails gives Medium and Active', async () => {
    const cloud = cloudAnswering({
      json: () => {
        throw Object.assign(new Error('down'),
          { statusCode: 500, headers: {}, content: 'down' });
      }
    });
    const routes = routesWith(cloud);
    const response = fakeResponse();
    await routes.active(visitor(), SEALED, newPage(routes).page, response);
    expect(JSON.parse(response.body))
      .toEqual({ source: 'Active', humanConfidence: 'Medium' });
  });
});

describe('Human Confidence example source', () => {
  const read = (name) => fs.readFileSync(path.join(FOLDER, name), 'utf8');

  test('never calls a redeem endpoint or sends a value field', () => {
    for (const name of ['server.js', 'page.html']) {
      const text = read(name);
      expect([name, /hc\/redeem/.test(text)]).toEqual([name, false]);
      expect([name, /set\("value"|form\.get\('value'\)/.test(text)])
        .toEqual([name, false]);
    }
  });
});

// The example reads its settings from the environment when it starts, so
// each case starts it as its own process.
describe('Human Confidence example as a process', () => {
  /**
   * A port nothing is listening on.
   *
   * @returns {Promise<number>} the port
   */
  const freePort = () => new Promise((resolve, reject) => {
    const probe = net.createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => resolve(port));
    });
  });

  /**
   * The body of one GET request.
   *
   * @param {string} url the URL to get
   * @returns {Promise<string>} the body
   */
  const get = (url) => new Promise((resolve, reject) => {
    http.get(url, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve(body));
    }).once('error', reject);
  });

  /**
   * Starts the example with the endpoint variables given and no others,
   * and returns the page it serves.
   *
   * @param {object} endpointVariables the endpoint variables to set
   * @returns {Promise<string>} the page
   */
  const pageServedWith = async (endpointVariables) => {
    const environment = Object.assign({}, process.env);
    delete environment._51DEGREES_CLOUD_ENDPOINT;
    const port = await freePort();
    const child = spawn(process.execPath, [SERVER], {
      env: Object.assign(environment, endpointVariables, {
        _51DEGREES_RESOURCE_KEY: RESOURCE,
        _51DEGREES_LICENSE_KEY: LICENSE,
        _51DEGREES_EXAMPLE_HTTP_PORTS: String(port)
      }),
      stdio: ['ignore', 'pipe', 'ignore']
    });
    try {
      await new Promise((resolve, reject) => {
        let output = '';
        child.stdout.on('data', (chunk) => {
          output += chunk;
          if (output.includes('Human Confidence demo on')) {
            resolve();
          }
        });
        child.once('error', reject);
        child.once('exit', (code) =>
          reject(new Error('the example stopped with code ' + code)));
      });
      return await get('http://127.0.0.1:' + port + '/');
    } finally {
      child.kill();
    }
  };

  // The start of the line of the page that carries the script address.
  const scriptLine = (base) =>
    'var SCRIPT = "' + base + RESOURCE + '.js?transaction=';

  test('the endpoint variable set gives its endpoint', async () => {
    const page = await pageServedWith({
      _51DEGREES_CLOUD_ENDPOINT: 'https://cloud.example/api/v4'
    });
    expect(page).toContain(scriptLine('https://cloud.example/api/v4/'));
  }, 30000);

  test('the endpoint variable not set gives the public cloud', async () => {
    const page = await pageServedWith({});
    expect(page).toContain(scriptLine('https://cloud.51degrees.com/api/v4/'));
  }, 30000);

  test('the page carries the resource key and never the license key',
    async () => {
      const page = await pageServedWith({});
      expect(page).toContain(RESOURCE);
      expect(page).toMatch(/var PAGE = "[\w-]{16,}";/);
      expect(page).not.toContain(LICENSE);
    }, 30000);

  test('with no resource key it ends cleanly and says how to get one',
    () => {
      const env = {};
      for (const [name, value] of Object.entries(process.env)) {
        if (!name.toUpperCase().endsWith('RESOURCE_KEY')) {
          env[name] = value;
        }
      }
      env._51DEGREES_EXAMPLE_HTTP_PORTS = '0';
      const result = spawnSync(process.execPath, [path.basename(SERVER)], {
        cwd: FOLDER,
        env,
        encoding: 'utf8',
        timeout: 30000
      });
      const printed = `${result.stdout || ''}\n${result.stderr || ''}`;
      expect({
        status: result.status,
        signal: result.signal,
        printed: result.status === 0 ? '' : printed
      }).toEqual({ status: 0, signal: null, printed: '' });
      expect(printed).toContain('_51DEGREES_RESOURCE_KEY');
      expect(printed).toMatch(new RegExp(
        'https://51degrees\\.com/configure[^\\s\'"<>]*' +
        '\\?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&'));
      const lines = (result.stdout || '').split(/\r?\n/)
        .filter((line) => line.trim() !== '');
      const links = lines.slice(lines.lastIndexOf('Find out more:') + 1);
      expect(lines).toContain('Find out more:');
      expect(links.length).toBeGreaterThan(0);
      for (const line of links) {
        expect(line).toMatch(/^\t[A-Z][^:]*: https:\/\/\S+$/);
      }
    }, 35000);
});

describe('Human Confidence example files', () => {
  const read = (name) => fs.readFileSync(path.join(FOLDER, name), 'utf8');

  test('the server listens on port 5151 unless the variable says otherwise', () => {
    const match =
      /\bconst\s+port\s*=\s*Number\(\s*(process\.env\._51DEGREES_EXAMPLE_HTTP_PORTS\s*\|\|\s*)(\d+)/
        .exec(read('server.js'));
    expect(match).not.toBeNull();
    expect(Number(match[2])).toBe(5151);
  });
});
