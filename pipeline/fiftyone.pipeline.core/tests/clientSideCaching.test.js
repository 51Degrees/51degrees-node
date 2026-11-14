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

// The caching headers of the client-side JSON and JavaScript endpoints, as
// the web integration specification's cache header detail sets them, and
// the 304 and 412 answers RFC 9110 section 13.1.2 gives a matching
// If-None-Match before the pipeline processes the request.

const http = require('http');
const path = require('path');
const { execFileSync } = require('child_process');
const request = require('supertest');

const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');
const Helpers = require('../helpers');

const USER_AGENT = 'Mozilla/5.0 (test)';
// supertest listens on a new port for each request, and the host is
// evidence, so every request names the same one.
const HOST = 'example.test';

/**
 * Builds a pipeline with one element that reads the User-Agent, counts the
 * requests it processes in state.processed, and fails while state.failing
 * is true.
 *
 * @param {{failing: boolean, processed?: number}} state whether the element
 * fails, and how many requests it has processed
 * @returns {object} the pipeline
 */
const makePipeline = (state) => {
  const element = new FlowElement({
    dataKey: 'test',
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
    processInternal: function (flowData) {
      state.processed = (state.processed || 0) + 1;
      if (state.failing) {
        throw new Error('The test element failed.');
      }
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { useragent: flowData.evidence.get('header.user-agent') }
      }));
    }
  });
  const pipeline = new PipelineBuilder({
    suppressProcessExceptions: true,
    useSetHeaderProperties: false,
    javascriptBuilderSettings: { endPoint: '/json' }
  }).add(element).build();
  pipeline.on('error', () => {});
  return pipeline;
};

/**
 * Builds a server for the pipeline makePipeline gives. It answers a
 * matching If-None-Match before processing, as the examples do, unless
 * state.processFirst is true, which is how a caller that processes every
 * request before writing the response behaves.
 *
 * @param {{failing: boolean, processed?: number, processFirst?: boolean,
 * maxAgeSeconds?: number}} state the element's state, whether to process
 * first, and the max-age to give the helpers
 * @returns {http.Server} the server
 */
const makeServer = (state) => {
  const pipeline = makePipeline(state);
  return http.createServer(async (req, res) => {
    // A fault answers 500 with its message, so a test fails on it rather
    // than waiting for a response that never comes.
    try {
      const options = state.maxAgeSeconds === undefined
        ? {}
        : { maxAgeSeconds: state.maxAgeSeconds };
      const flowData = pipeline.createFlowData();
      await flowData.evidence.addFromRequestAsync(req);
      if (state.processFirst !== true &&
        Helpers.writeClientSideNotModified(req, res, flowData, options)) {
        return;
      }
      await flowData.process();
      if (req.url.startsWith('/json')) {
        Helpers.writeClientSideResponse(req, res, flowData,
          'application/json', JSON.stringify(flowData.jsonbundler.json),
          options);
      } else {
        Helpers.writeClientSideResponse(req, res, flowData,
          'application/x-javascript', flowData.javascriptbuilder.javascript,
          options);
      }
    } catch (e) {
      res.statusCode = 500;
      res.end(String(e));
    }
  });
};

const getScript = (server, headers = {}) => request(server)
  .get('/51Degrees.core.js')
  .set('Host', HOST)
  .set('User-Agent', USER_AGENT)
  .set(headers);

describe('client-side caching headers', () => {
  test('a response carries the caching headers and a weak ETag', async () => {
    const server = makeServer({ failing: false });

    const script = await getScript(server);
    const json = await request(server).post('/json').set('Host', HOST)
      .set('User-Agent', USER_AGENT).type('form').send({ a: '1' });

    for (const response of [script, json]) {
      expect(response.statusCode).toBe(200);
      expect(response.headers['cache-control']).toBe('private, max-age=1800');
      expect(response.headers.vary).toBe('user-agent');
      expect(response.headers.etag).toMatch(/^W\/"[0-9a-f]{32}"$/);
      expect(Number(response.headers['content-length']))
        .toBe(Buffer.byteLength(response.text));
    }
    expect(script.headers['content-type']).toBe('application/x-javascript');
    expect(json.headers['content-type']).toBe('application/json');
  });

  test('the same evidence gives the same ETag in every process', () => {
    const fixture = path.join(__dirname, 'clientSideETag.js');
    const etagIn = (userAgent) => execFileSync(process.execPath,
      [fixture, userAgent], { encoding: 'utf8', timeout: 20000 }).trim();

    const first = etagIn(USER_AGENT);
    const second = etagIn(USER_AGENT);
    const other = etagIn('Mozilla/5.0 (another)');

    expect(first).toMatch(/^W\/"[0-9a-f]{32}"$/);
    expect(second).toBe(first);
    expect(other).not.toBe(first);
  });

  test('a matching If-None-Match gets a 304 with the same headers',
    async () => {
      const server = makeServer({ failing: false });
      const first = await getScript(server);

      for (const value of [first.headers.etag,
        first.headers.etag.substring(2), `W/"other", ${first.headers.etag}`,
        '*']) {
        const again = await getScript(server, { 'If-None-Match': value });
        expect({ value, status: again.statusCode })
          .toEqual({ value, status: 304 });
        expect(again.text).toBe('');
        expect(again.headers.etag).toBe(first.headers.etag);
        expect(again.headers['cache-control']).toBe('private, max-age=1800');
        expect(again.headers.vary).toBe('user-agent');
      }

      const changed = await getScript(server, { 'If-None-Match': 'W/"other"' });
      expect(changed.statusCode).toBe(200);
      expect(changed.headers.etag).toBe(first.headers.etag);
    });

  test('a matching If-None-Match on a POST gets a 412', async () => {
    const state = { failing: false };
    const server = makeServer(state);
    const first = await request(server).post('/json').set('Host', HOST)
      .set('User-Agent', USER_AGENT).type('form').send({ a: '1' });

    const again = await request(server).post('/json').set('Host', HOST)
      .set('User-Agent', USER_AGENT).set('If-None-Match', first.headers.etag)
      .type('form').send({ a: '1' });

    expect(again.statusCode).toBe(412);
    expect(state.processed).toBe(1);
  });

  // web-integration.md lines 242 to 253: the endpoint compares
  // If-None-Match with the ETag before the pipeline processes the request,
  // and does not process a request whose If-None-Match matches.
  test('a matching If-None-Match is answered without processing',
    async () => {
      const state = { failing: false };
      const server = makeServer(state);
      const first = await getScript(server);
      expect(state.processed).toBe(1);

      const again = await getScript(server,
        { 'If-None-Match': first.headers.etag });
      expect(again.statusCode).toBe(304);
      expect(again.headers.etag).toBe(first.headers.etag);
      expect(state.processed).toBe(1);

      const changed = await getScript(server,
        { 'If-None-Match': 'W/"other"' });
      expect(changed.statusCode).toBe(200);
      expect(state.processed).toBe(2);
    });

  // web-integration.md line 332: max-age is configurable.
  test('the max-age option is used on a 200 and a 304', async () => {
    const server = makeServer({ failing: false, maxAgeSeconds: 60 });
    const first = await getScript(server);
    expect(first.headers['cache-control']).toBe('private, max-age=60');

    for (const processFirst of [false, true]) {
      const again = await getScript(
        makeServer({ failing: false, maxAgeSeconds: 60, processFirst }),
        { 'If-None-Match': first.headers.etag });
      expect({ processFirst, status: again.statusCode })
        .toEqual({ processFirst, status: 304 });
      expect(again.headers['cache-control']).toBe('private, max-age=60');
    }
  });

  // A browser can stop waiting while the pipeline processes, and the
  // request's socket then has no addresses. The ETag uses what was read
  // from the request when the evidence was added.
  test('the ETag does not read the request again after processing',
    async () => {
      const pipeline = makePipeline({ failing: false });
      const req = {
        method: 'GET',
        url: '/51Degrees.core.js',
        headers: { host: HOST, 'user-agent': USER_AGENT },
        connection: {
          encrypted: false,
          remoteAddress: '127.0.0.1',
          localAddress: '127.0.0.1'
        }
      };
      const flowData = pipeline.createFlowData();
      flowData.evidence.addFromRequest(req);
      await flowData.process();
      req.connection = {};

      const headers = {};
      let ended = false;
      const res = {
        statusCode: 0,
        setHeader: (name, value) => { headers[name.toLowerCase()] = value; },
        end: () => { ended = true; }
      };
      Helpers.writeClientSideResponse(req, res, flowData,
        'application/x-javascript', flowData.javascriptbuilder.javascript);

      expect(ended).toBe(true);
      expect(res.statusCode).toBe(200);
      expect(headers.etag).toMatch(/^W\/"[0-9a-f]{32}"$/);
    });

  test('a response to a request that recorded errors has no ETag',
    async () => {
      const state = { failing: false };
      const server = makeServer(state);
      const good = await getScript(server);

      state.failing = true;
      const failed = await getScript(server);
      expect(failed.statusCode).toBe(200);
      expect(failed.headers['cache-control']).toBe('private, no-cache');
      expect(failed.headers.etag).toBeUndefined();

      // A browser that kept the good response keeps it through the outage,
      // and its cache keeps the ETag and max-age (web-integration.md lines
      // 313 to 321), whether or not the caller processed the request first.
      const kept = await getScript(server,
        { 'If-None-Match': good.headers.etag });
      expect(kept.statusCode).toBe(304);
      expect(kept.headers['cache-control']).toBe('private, max-age=1800');
      expect(kept.headers.etag).toBe(good.headers.etag);
      expect(kept.headers.vary).toBe('user-agent');

      const keptAfterProcessing = await getScript(
        makeServer({ failing: true, processFirst: true }),
        { 'If-None-Match': good.headers.etag });
      expect(keptAfterProcessing.statusCode).toBe(304);
      expect(keptAfterProcessing.headers['cache-control'])
        .toBe('private, max-age=1800');
      expect(keptAfterProcessing.headers.etag).toBe(good.headers.etag);

      // Once processing works again, the ETag is the one it was.
      state.failing = false;
      const recovered = await getScript(server);
      expect(recovered.headers.etag).toBe(good.headers.etag);
    });
});
