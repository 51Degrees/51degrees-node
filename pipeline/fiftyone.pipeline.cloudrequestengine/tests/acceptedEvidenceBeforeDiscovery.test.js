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

// An Element accepts only the Evidence that can change its results, because
// the Pipeline's accepted Evidence decides the cache keys, the ETag and the
// Vary header (advertize-accepted-evidence.md line 25). The Cloud Request
// Engine's results cannot change until discovery has given the keys the
// cloud service accepts, so until then it accepts none
// (cloud-request-engine.md lines 296 and 297). It keeps what is added
// meanwhile, so a request made before discovery ends still sends it.

const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');
const CloudRequestEngine = require('../cloudRequestEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));

const RESOURCE_KEY = 'AAAAAAAAAAAA';
const BASE_URL = 'https://cloud.example/api/v4/';
const AGENT = 'agent added before discovery';
const UNAVAILABLE = { statusCode: 503, headers: {}, content: 'Unavailable' };

// A stand-in cloud service whose discovery answers once it is released,
// with the failure given if there is one, and which records the content of
// each request for results.
class HeldClient extends MockRequestClient {
  constructor (failure) {
    super();
    this.failure = failure;
    this.sent = [];
    this.held = new Promise((resolve) => { this.release = resolve; });
  }

  get (url, origin) {
    return this.held.then(() => this.failure === undefined
      ? super.get(url, origin)
      : Promise.reject(this.failure));
  }

  post (url, data, origin) {
    this.sent.push(data);
    return super.post(url, data, origin);
  }
}

const build = (client) => {
  const engine = new CloudRequestEngine({
    resourceKey: RESOURCE_KEY,
    baseURL: BASE_URL,
    requestClient: client
  });
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false,
    suppressProcessExceptions: true
  }).add(engine).build();
  return { engine, pipeline };
};

// Lets the stand-in's answers, and all that follows from them, finish.
const settle = () => new Promise((resolve) => setImmediate(resolve));

test('the engine accepts no Evidence until discovery has answered',
  async () => {
    const client = new HeldClient();
    const { engine, pipeline } = build(client);
    expect(engine.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
      .toBeFalsy();
    expect(pipeline.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
      .toBeFalsy();

    client.release();
    await settle();

    expect(engine.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
      .toBeTruthy();
    expect(pipeline.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
      .toBeTruthy();
    expect(engine.evidenceKeyFilter.filterEvidenceKey('header.anything'))
      .toBeFalsy();
  });

test('Evidence added before discovery answers is kept, sent and in the ' +
  'cache key', async () => {
  const client = new HeldClient();
  const { engine, pipeline } = build(client);
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', AGENT);
  expect(flowData.evidence.getAll()['header.user-agent']).toBe(AGENT);

  const processed = flowData.process();
  client.release();
  await processed;

  expect(Object.keys(flowData.errors)).toEqual([]);
  expect(JSON.stringify(client.sent)).toContain(AGENT);
  expect(engine.cacheKey(flowData)).toContain(AGENT);
});

test('once discovery has answered the engine keeps nothing it does not ' +
  'accept', async () => {
  const client = new HeldClient();
  client.release();
  const { engine, pipeline } = build(client);
  await settle();

  expect(engine.keptEvidenceKeyFilter).toBeUndefined();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.anything', 'value');
  expect(flowData.evidence.getAll()).not.toHaveProperty('header.anything');
});

test('after a transient discovery failure the engine still accepts no ' +
  'Evidence and keeps what is added', async () => {
  const client = new HeldClient(UNAVAILABLE);
  client.release();
  const { engine, pipeline } = build(client);
  await settle();

  expect(engine.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
    .toBeFalsy();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', AGENT);
  expect(flowData.evidence.getAll()['header.user-agent']).toBe(AGENT);
});
