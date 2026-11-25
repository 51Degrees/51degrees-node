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
// a stand-in for the cloud service, so no network is touched. Each route
// must pass on what it is given, and answer the page with what the cloud
// said.
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
const { demoRoutes } = require('../examples/human-confidence-web/server');

const API = 'https://cloud.example/api/v4/';
const RESOURCE = 'AQTestResourceKey';
const LICENSE = 'AQTestLicenseKey';

// What the cloud's accessibleproperties answers for a key, with the
// properties named under one product.
const accessible = (...names) => JSON.stringify({
  Products: {
    derived: {
      DataTier: 'CloudV5Pro',
      Properties: names.map((name) => ({ Name: name, Type: 'String' }))
    }
  }
});

/**
 * A stand-in for fetch that records each call and answers from a function.
 *
 * @param {function(string, object): object} answer given the URL and the
 * form fields sent, returns the status and body to answer with, or throws
 * @returns {Function} the stand-in, with the calls made in its calls member
 */
function cloudAnswering (answer) {
  const stand = async (url, options = {}) => {
    const fields = options.body === undefined
      ? undefined
      : Object.fromEntries(new URLSearchParams(String(options.body)));
    stand.calls.push({ url, method: options.method || 'GET', fields });
    const { status = 200, body = '' } = answer(url, fields);
    return {
      status,
      ok: status >= 200 && status < 300,
      text: async () => body
    };
  };
  stand.calls = [];
  return stand;
}

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

const routesWith = (fetch, license = LICENSE) =>
  demoRoutes({ resource: RESOURCE, license, api: API, fetch });

const unreachable = () => {
  const failure = new TypeError('fetch failed');
  failure.cause = new Error('ECONNREFUSED');
  throw failure;
};

describe('Human Confidence example /check route', () => {
  test('a key that carries HumanConfidence is reported as carrying it',
    async () => {
      const cloud = cloudAnswering(() => ({
        body: accessible('HumanConfidence', 'HumanConfidenceSource')
      }));
      const response = fakeResponse();
      await routesWith(cloud).check(response);

      expect(response.status).toBe(200);
      expect(response.headers['Content-Type']).toBe('application/json');
      expect(JSON.parse(response.body)).toEqual({ humanConfidence: true });
      expect(cloud.calls).toEqual([{
        url: API + 'accessibleproperties?resource=' + RESOURCE,
        method: 'GET',
        fields: undefined
      }]);
    });

  test('a key that does not carry it is reported as not carrying it',
    async () => {
      const cloud = cloudAnswering(() => ({ body: accessible('IsMobile') }));
      const response = fakeResponse();
      await routesWith(cloud).check(response);
      expect(JSON.parse(response.body)).toEqual({ humanConfidence: false });
    });

  test('a cloud that refuses the key answers with the status', async () => {
    const cloud = cloudAnswering(() => ({
      status: 400, body: '{"errors":["bad key"]}'
    }));
    const response = fakeResponse();
    await routesWith(cloud).check(response);
    expect(JSON.parse(response.body))
      .toEqual({ error: 'HTTP 400: {"errors":["bad key"]}' });
  });

  test('an unreachable cloud answers with the cause', async () => {
    const response = fakeResponse();
    await routesWith(cloudAnswering(unreachable)).check(response);
    expect(JSON.parse(response.body)).toEqual({ error: 'ECONNREFUSED' });
  });
});

describe('Human Confidence example /passive route', () => {
  // The cloud lists two headers, so only those two are passed on.
  const passiveCloud = (result) => cloudAnswering((url) =>
    url === API + 'evidencekeys'
      ? {
          body: JSON.stringify([
            'header.user-agent', 'header.Sec-CH-UA', 'query.user-agent',
            'server.client-ip'
          ])
        }
      : result);

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

  test('passes on the headers the cloud lists and the address, and ' +
    'answers with the source and level the cloud gave', async () => {
    const cloud = passiveCloud({
      body: JSON.stringify({
        derived: {
          humanconfidence: 'Medium',
          humanconfidencesource: 'Passive'
        }
      })
    });
    const response = fakeResponse();
    await routesWith(cloud).passive(visitor(), response);

    expect(response.status).toBe(200);
    expect(JSON.parse(response.body))
      .toEqual({ source: 'Passive', humanConfidence: 'Medium' });
    expect(cloud.calls[1]).toEqual({
      url: API + RESOURCE + '.json',
      method: 'POST',
      fields: {
        'user-agent': 'Mozilla/5.0 (test)',
        'sec-ch-ua': '"Chromium";v="140"',
        'client-ip': '203.0.113.7'
      }
    });
  });

  test('never sends the license key', async () => {
    const cloud = passiveCloud({ body: '{"derived":{}}' });
    await routesWith(cloud).passive(visitor(), fakeResponse());
    expect(JSON.stringify(cloud.calls)).not.toContain(LICENSE);
  });

  test('asks the cloud for its evidence keys once', async () => {
    const cloud = passiveCloud({ body: '{"derived":{}}' });
    const routes = routesWith(cloud);
    await routes.passive(visitor(), fakeResponse());
    await routes.passive(visitor(), fakeResponse());
    expect(cloud.calls.map((call) => call.url)).toEqual([
      API + 'evidencekeys',
      API + RESOURCE + '.json',
      API + RESOURCE + '.json'
    ]);
  });

  test('sends an IPv4 address mapped to IPv6 as IPv4', async () => {
    const cloud = passiveCloud({ body: '{"derived":{}}' });
    await routesWith(cloud)
      .passive(visitor('::ffff:203.0.113.7'), fakeResponse());
    expect(cloud.calls[1].fields['client-ip']).toBe('203.0.113.7');
  });

  test('an answer without the properties gives neither', async () => {
    const cloud = passiveCloud({ body: '{"device":{"ismobile":false}}' });
    const response = fakeResponse();
    await routesWith(cloud).passive(visitor(), response);
    expect(JSON.parse(response.body))
      .toEqual({ source: null, humanConfidence: null });
  });

  // A key outside the Bespoke product is answered with no source, with or
  // without a level. The route gives what the cloud gave and makes up
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
      const cloud = passiveCloud({ body: JSON.stringify({ derived }) });
      const response = fakeResponse();
      await routesWith(cloud).passive(visitor(), response);
      expect(JSON.parse(response.body))
        .toEqual({ source: null, humanConfidence: level });
    });

  test('a cloud failure answers with the status and the body', async () => {
    const cloud = passiveCloud({ status: 403, body: 'Forbidden' });
    const response = fakeResponse();
    await routesWith(cloud).passive(visitor(), response);
    expect(JSON.parse(response.body))
      .toEqual({ error: 'HTTP 403: Forbidden' });
  });

  test('an unreachable cloud answers with the cause', async () => {
    const response = fakeResponse();
    await routesWith(cloudAnswering(unreachable))
      .passive(visitor(), response);
    expect(JSON.parse(response.body)).toEqual({ error: 'ECONNREFUSED' });
  });
});

describe('Human Confidence example /redeem route', () => {
  test('redeems the sealed value with the license key and relays the ' +
    'answer as the cloud gave it', async () => {
    const answer = '{"humanConfidence":"High","secondsSinceVerified":1}';
    const cloud = cloudAnswering(() => ({ body: answer }));
    const response = fakeResponse();
    await routesWith(cloud).redeem('sealed+value/=', response);

    expect(response.status).toBe(200);
    expect(response.headers['Content-Type']).toBe('application/json');
    expect(response.body).toBe(answer);
    expect(cloud.calls).toEqual([{
      url: API + 'hc/redeem',
      method: 'POST',
      fields: {
        sealedResult: 'sealed+value/=',
        value: 'sealed+value/=',
        license: LICENSE
      }
    }]);
  });

  test('a second redeem of the same value relays replayed', async () => {
    let redeemed = false;
    const cloud = cloudAnswering(() => {
      const body = redeemed
        ? '{"result":"replayed"}'
        : '{"humanConfidence":"High","secondsSinceVerified":1}';
      redeemed = true;
      return { body };
    });
    const routes = routesWith(cloud);
    await routes.redeem('sealed', fakeResponse());
    const second = fakeResponse();
    await routes.redeem('sealed', second);
    expect(JSON.parse(second.body)).toEqual({ result: 'replayed' });
  });

  test('relays an answer with status as the cloud gave it', async () => {
    const answer = '{"humanConfidence":"Medium","status":"replayed"}';
    const cloud = cloudAnswering(() => ({ body: answer }));
    const response = fakeResponse();
    await routesWith(cloud).redeem('sealed', response);
    expect(response.status).toBe(200);
    expect(response.body).toBe(answer);
  });

  test('sends no license field when no license key is set', async () => {
    const cloud = cloudAnswering(() => ({ body: '{"result":"unreadable"}' }));
    await routesWith(cloud, '').redeem('sealed', fakeResponse());
    expect(cloud.calls[0].fields)
      .toEqual({ sealedResult: 'sealed', value: 'sealed' });
  });

  test('relays a status other than 200 with its body', async () => {
    const cloud = cloudAnswering(() => ({
      status: 400, body: '{"errors":["value is required"]}'
    }));
    const response = fakeResponse();
    await routesWith(cloud).redeem('', response);
    expect(response.status).toBe(400);
    expect(response.body).toBe('{"errors":["value is required"]}');
  });

  test('a service that does not redeem is named', async () => {
    const cloud = cloudAnswering(() => ({ status: 404, body: 'Not found' }));
    const response = fakeResponse();
    await routesWith(cloud).redeem('sealed', response);
    expect(JSON.parse(response.body).error).toContain(API);
  });

  test('an unreachable cloud answers 502 with the cause', async () => {
    const response = fakeResponse();
    await routesWith(cloudAnswering(unreachable)).redeem('sealed', response);
    expect(response.status).toBe(502);
    expect(JSON.parse(response.body)).toEqual({ error: 'ECONNREFUSED' });
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

  // The line of the page that carries the API base.
  const apiLine = (base) => 'var API = "' + base + '";';

  test('the endpoint variable set gives its endpoint', async () => {
    const page = await pageServedWith({
      _51DEGREES_CLOUD_ENDPOINT: 'https://cloud.example/api/v4'
    });
    expect(page).toContain(apiLine('https://cloud.example/api/v4/'));
  }, 30000);

  test('the endpoint variable not set gives the public cloud', async () => {
    const page = await pageServedWith({});
    expect(page).toContain(apiLine('https://cloud.51degrees.com/api/v4/'));
  }, 30000);

  test('the page carries the resource key and never the license key',
    async () => {
      const page = await pageServedWith({});
      expect(page).toContain('var RESOURCE = "' + RESOURCE + '";');
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
