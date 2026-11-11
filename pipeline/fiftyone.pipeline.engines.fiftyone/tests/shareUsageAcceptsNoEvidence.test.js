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

// The usage sharing element accepts no evidence, so that caching, the ETag
// and the Vary header never depend on it. It shares what it finds in the
// flow data and in the web request the web integration supplies as
// server.http-request.

const http = require('http');
const zlib = require('zlib');
const request = require('supertest');
const {
  PipelineBuilder, FlowElement, ElementDataDictionary,
  BasicListEvidenceKeyFilter, Helpers
} = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// Usage data received by the local usage receiver.
let received = [];
let receiver = null;
let endpoint = null;

beforeEach((done) => {
  received = [];
  receiver = http.createServer((req, res) => {
    let data = '';
    const gunzip = zlib.createGunzip();
    req.pipe(gunzip);
    gunzip.on('data', (chunk) => { data += chunk; });
    gunzip.on('end', () => {
      received.push(data);
      res.writeHead(200);
      res.end();
    });
  });
  receiver.listen(0, '127.0.0.1', () => {
    endpoint = `http://127.0.0.1:${receiver.address().port}/`;
    done();
  });
});

afterEach((done) => {
  receiver.close(done);
});

/**
 * Waits until the receiver has had the given number of messages.
 *
 * @param {number} count the number of messages
 * @returns {Promise<void>} resolves when they have arrived
 */
const receivedCount = (count) => new Promise((resolve, reject) => {
  const started = Date.now();
  const check = () => {
    if (received.length >= count) {
      resolve();
    } else if (Date.now() - started > 5000) {
      reject(new Error(`${received.length} of ${count} messages received`));
    } else {
      setTimeout(check, 20);
    }
  };
  check();
});

/**
 * An element that reads only the User-Agent.
 *
 * @returns {FlowElement} the element
 */
const testEngine = () => new FlowElement({
  dataKey: 'test',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: { useragent: flowData.evidence.get('header.user-agent') }
    }));
  }
});

/**
 * A pipeline holding only the test engine and the usage sharing element.
 *
 * @param {object} [options] options for the usage sharing element
 * @returns {object} the pipeline
 */
const usagePipeline = (options = {}) => new PipelineBuilder({
  addJavaScriptBuilder: false,
  useSetHeaderProperties: false
}).add(testEngine())
  .add(new ShareUsage(Object.assign(
    { requestedPackageSize: 1, endpoint }, options)))
  .build();

/**
 * Whether any element of a pipeline accepts an evidence key.
 *
 * @param {object} pipeline the pipeline
 * @param {string} key the evidence key
 * @returns {boolean} true when an element accepts it
 */
const accepts = (pipeline, key) => Object.values(pipeline.flowElements)
  .some((element) => element.evidenceKeyFilter.filterEvidenceKey(key));

/**
 * Processes a real HTTP request with the given headers through a pipeline,
 * reading the evidence from it as a web integration does.
 *
 * @param {object} pipeline the pipeline
 * @param {object} headers the request headers
 * @param {object} [session] the session object of the request, if it has one
 * @param {string} [target] the request target, a page with a query string
 * unless one is given
 * @returns {Promise<object>} the processed flow data
 */
const processRequest = (pipeline, headers, session,
  target = '/page?51D_x=1&other=2') => {
  return new Promise((resolve, reject) => {
    let flowData;
    const server = http.createServer(async (req, res) => {
      try {
        if (session) {
          req.session = session;
        }
        flowData = pipeline.createFlowData();
        await flowData.evidence.addFromRequestAsync(req);
        await flowData.process();
        res.end('done');
      } catch (e) {
        reject(e);
        res.end();
      }
    });
    request(server).get(target).set(headers)
      .then(() => resolve(flowData), reject);
  });
};

describe('usage sharing accepts no evidence', () => {
  test('a pipeline with usage sharing does not accept arbitrary headers',
    () => {
      const pipeline = usagePipeline();

      expect(accepts(pipeline, 'header.user-agent')).toBe(true);
      expect(accepts(pipeline, 'header.if-none-match')).toBe(false);
      expect(accepts(pipeline, 'header.x-test')).toBe(false);
      expect(accepts(pipeline, 'cookie.51d_test')).toBe(false);
    });

  test('the web request is in the evidence as server.http-request',
    async () => {
      const flowData = await processRequest(usagePipeline(),
        { 'User-Agent': 'agent', 'X-Test': 'test value' });

      const view = flowData.evidence.get('server.http-request');
      expect(view['header.x-test']).toBe('test value');
      expect(view['header.user-agent']).toBe('agent');
      expect(view['query.51D_x']).toBe('1');
      expect(Object.isFrozen(view)).toBe(true);
      expect(Object.keys(flowData.evidence.getAll()))
        .not.toContain('server.http-request');
    });

  test('the web request has every part the specification names', async () => {
    const flowData = await processRequest(usagePipeline(),
      { 'User-Agent': 'agent', Cookie: 'sessionid=cookie value' },
      { '51D_session': 'one', theme: 'dark' });

    const view = flowData.evidence.get('server.http-request');
    expect(view['header.user-agent']).toBe('agent');
    expect(view['cookie.sessionid']).toBe('cookie value');
    expect(view['query.51D_x']).toBe('1');
    expect(view['session.51D_session']).toBe('one');
    expect(view['session.theme']).toBe('dark');
    expect(view['server.client-ip']).toBeDefined();
    expect(view['header.protocol']).toBe('http');
    expect(view['server.request-method']).toBe('GET');
    expect(view['server.request-path']).toBe('/page');
    // All three request line values are on every view, undecoded, so that
    // an absent key says the request line was not supplied.
    expect(view['server.request-query']).toBe('51D_x=1&other=2');
    expect(Object.keys(view)).not.toContain('header.cookie');
  });

  test('the request line is on the view with an empty query where there ' +
    'is none', async () => {
    const flowData = await processRequest(usagePipeline(),
      { 'User-Agent': 'agent' }, undefined, '/plain');

    const view = flowData.evidence.get('server.http-request');
    expect(view['server.request-method']).toBe('GET');
    expect(view['server.request-path']).toBe('/plain');
    expect(view['server.request-query']).toBe('');
    expect(Object.keys(view)).toContain('server.request-query');
  });

  test('the method is shared, and the path and Cookie header are not, ' +
    'even when all evidence is shared', async () => {
    const pipeline = usagePipeline({ shareAll: true });

    await processRequest(pipeline, {
      'User-Agent': 'agent value',
      Cookie: 'sessionid=cookie value'
    }, { '51D_session': 'session one' });
    await receivedCount(1);

    expect(received[0]).toContain('request-method');
    expect(received[0]).toContain('session one');
    expect(received[0]).not.toContain('/page');
    // request-path and request-query are both never shared, whatever the
    // settings, so neither name reaches the service.
    expect(received[0]).not.toContain('request-path');
    expect(received[0]).not.toContain('request-query');
    expect(received[0]).not.toMatch(/header Name="cookie"/i);
  });

  test('a header no other element accepts is shared from the web request, ' +
    'and the cookie header and a blocked header are not', async () => {
    const pipeline = usagePipeline({ headerBlacklist: ['x-blocked'] });

    await processRequest(pipeline, {
      'User-Agent': 'agent value',
      'X-Test': 'test value',
      'X-Blocked': 'blocked value',
      Cookie: '51D_ScreenPixelsWidth=1080; sessionid=cookie value'
    });
    await receivedCount(1);

    expect(received[0]).toContain('<header Name="user-agent">agent value</header>');
    expect(received[0]).toContain('<header Name="x-test">test value</header>');
    expect(received[0]).toContain('<cookie Name="51D_ScreenPixelsWidth">1080</cookie>');
    expect(received[0]).toContain('<query Name="51D_x">1</query>');
    expect(received[0]).not.toContain('blocked value');
    expect(received[0]).not.toContain('cookie value');
    expect(received[0]).not.toContain('Name="cookie"');
    expect(received[0]).not.toContain('http-request');
    expect(received[0]).not.toContain('Name="other"');
  });

  test('a value only in server.http-request is shared, and evidence wins ' +
    'over the request for the same key', async () => {
    const pipeline = usagePipeline();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('server.http-request', {
      'header.x-only-in-request': 'request value',
      'header.user-agent': 'request agent'
    });
    flowData.evidence.add('header.user-agent', 'evidence agent');

    await flowData.process();
    await receivedCount(1);

    expect(received[0]).toContain('request value');
    expect(received[0]).toContain('<header Name="user-agent">evidence agent</header>');
    expect(received[0]).not.toContain('request agent');
    expect(received[0]).not.toContain('http-request');
  });

  test('a key in both places whose letters differ is shared once',
    async () => {
      const pipeline = usagePipeline();
      const flowData = pipeline.createFlowData();
      // Added before the request, so the evidence keeps this spelling and
      // the view carries the other one.
      flowData.evidence.add('HEADER.User-Agent', 'evidence agent');
      flowData.evidence.add('server.http-request', {
        'header.user-agent': 'request agent'
      });

      await flowData.process();
      await receivedCount(1);

      const names = received[0].match(/<header Name="[^"]*user-agent"/gi);
      expect(names).toHaveLength(1);
      expect(received[0]).toContain('evidence agent');
      expect(received[0]).not.toContain('request agent');
    });

  test('evidence added by hand is shared as before', async () => {
    const pipeline = usagePipeline();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'some user agent');
    flowData.evidence.add('header.x-test', 'test value');
    flowData.evidence.add('cookie.51d_screenpixelswidth', '1080');
    flowData.evidence.add('query.51d_gethighentropyvalues', 'hev');
    flowData.evidence.add('server.client-ip', '1.2.3.4');
    flowData.evidence.add('cookie.sessionid', 'cookie value');
    flowData.evidence.add('query.password', 'password value');

    await flowData.process();
    await receivedCount(1);

    expect(received[0]).toContain('<header Name="user-agent">some user agent</header>');
    expect(received[0]).toContain('<header Name="x-test">test value</header>');
    expect(received[0]).toContain('<cookie Name="51d_screenpixelswidth">1080</cookie>');
    expect(received[0]).toContain('<query Name="51d_gethighentropyvalues">hev</query>');
    expect(received[0]).toContain('<ClientIP>1.2.3.4</ClientIP>');
    expect(received[0]).not.toContain('cookie value');
    expect(received[0]).not.toContain('password value');
  });
});

describe('client-side endpoint with usage sharing', () => {
  /**
   * A server whose pipeline holds the test engine, usage sharing and the
   * JavaScript builder, serving the client-side JavaScript.
   *
   * @returns {http.Server} the server
   */
  const scriptServer = () => {
    const pipeline = new PipelineBuilder({
      useSetHeaderProperties: false,
      javascriptBuilderSettings: { endPoint: '/json' }
    }).add(testEngine())
      .add(new ShareUsage({ requestedPackageSize: 1000, endpoint }))
      .build();
    pipeline.on('error', () => {});
    return http.createServer(async (req, res) => {
      try {
        const flowData = pipeline.createFlowData();
        await flowData.evidence.addFromRequestAsync(req);
        await flowData.process();
        Helpers.writeClientSideResponse(req, res, flowData,
          'application/x-javascript', flowData.javascriptbuilder.javascript);
      } catch (e) {
        res.statusCode = 500;
        res.end(String(e));
      }
    });
  };

  const getScript = (server, headers = {}) => request(server)
    .get('/51Degrees.core.js')
    .set('Host', 'example.test')
    .set('User-Agent', 'agent')
    .set(headers);

  test('a revalidation carrying If-None-Match gets a 304', async () => {
    const server = scriptServer();
    const first = await getScript(server);
    expect(first.statusCode).toBe(200);
    expect(first.headers.etag).toMatch(/^W\/"[0-9a-f]{32}"$/);

    const again = await getScript(server,
      { 'If-None-Match': first.headers.etag });
    expect(again.statusCode).toBe(304);
    expect(again.headers.etag).toBe(first.headers.etag);
  });

  test('evidence only usage sharing reads takes no part in the ETag',
    async () => {
      const server = scriptServer();
      const plain = await getScript(server);
      const withCookie = await getScript(server,
        { Cookie: '51D_Test=1' });

      expect(plain.headers.etag).toMatch(/^W\/"[0-9a-f]{32}"$/);
      expect(withCookie.headers.etag).toBe(plain.headers.etag);
    });
});
