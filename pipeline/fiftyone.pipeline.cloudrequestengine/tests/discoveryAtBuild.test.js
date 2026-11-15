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

// The Cloud Request Engine makes both discovery requests when it is built,
// so that a built engine is ready to process (cloud-request-engine.md line
// 241). A transient failure then, being no answer or a 5xx, does not fail
// the build. The engine logs a warning and tries discovery again on first
// use (lines 258 to 263).

const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');
const CloudRequestEngine = require('../cloudRequestEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));

const RESOURCE_KEY = 'AAAAAAAAAAAA';
const BASE_URL = 'https://cloud.example/api/v4/';

// Both discovery requests, by the last part of their address.
const DISCOVERY = ['accessibleproperties', 'evidencekeys'];

// What the request client gives for a request that got no answer, and for
// a 5xx and a 4xx answer.
const NO_ANSWER = { content: 'connect ECONNREFUSED 192.0.2.1:443' };
const UNAVAILABLE = { statusCode: 503, headers: {}, content: 'Unavailable' };
const REFUSED = {
  statusCode: 403,
  headers: {},
  content: JSON.stringify({ errors: ['The resource key is not valid.'] })
};

// A stand-in cloud service that records each discovery request and fails
// the first ones, as many as it is told, with the failure given.
class CountingClient extends MockRequestClient {
  constructor (failures = 0, failure = undefined) {
    super();
    this.requests = [];
    this.failures = failures;
    this.failure = failure;
  }

  get (url, origin) {
    this.requests.push(url.replace(BASE_URL, '').split('?')[0]);
    if (this.failures > 0) {
      this.failures -= 1;
      return Promise.reject(this.failure);
    }
    return super.get(url, origin);
  }
}

const engineFor = (requestClient) => new CloudRequestEngine({
  resourceKey: RESOURCE_KEY,
  baseURL: BASE_URL,
  requestClient
});

/**
 * A Pipeline holding the engine, which records what it logs rather than
 * throwing a processing error.
 *
 * @param {CloudRequestEngine} engine the engine
 * @returns {object} the Pipeline and the warnings and errors it logs
 */
const pipelineFor = (engine) => {
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false,
    suppressProcessExceptions: true
  }).add(engine).build();
  const logged = { warn: [], error: [] };
  const text = (message) => typeof message === 'string'
    ? message
    : JSON.stringify(message);
  pipeline.on('warn', (message) => logged.warn.push(text(message)));
  pipeline.on('error', (message) => logged.error.push(text(message)));
  return { pipeline, logged };
};

// Lets the stand-in's answers, and all that follows from them, finish.
const settle = () => new Promise((resolve) => setImmediate(resolve));

const processOne = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'agent');
  await flowData.process();
  return flowData;
};

test('both discovery requests are made when the engine is built', () => {
  const client = new CountingClient();
  engineFor(client);
  expect(client.requests.sort()).toEqual(DISCOVERY);
});

test('a built engine is ready before it first processes', async () => {
  const engine = engineFor(new CountingClient());
  pipelineFor(engine);
  await settle();
  expect(engine.keysAndPropertiesFetched).toBe(true);
  expect(Object.keys(engine.flowElementProperties)).toEqual(['device']);
  expect(engine.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
    .toBeTruthy();
  expect(engine.evidenceKeyFilter.filterEvidenceKey('header.anything'))
    .toBeFalsy();
});

test('a process that starts while discovery is under way waits for it ' +
  'rather than asking again', async () => {
  const client = new CountingClient();
  const { pipeline, logged } = pipelineFor(engineFor(client));
  const first = await processOne(pipeline);
  const second = await processOne(pipeline);
  expect(Object.keys(first.errors)).toEqual([]);
  expect(Object.keys(second.errors)).toEqual([]);
  expect(client.requests.sort()).toEqual(DISCOVERY);
  expect(logged).toEqual({ warn: [], error: [] });
});

describe.each([
  ['no answer', NO_ANSWER, 'ECONNREFUSED'],
  ['a 5xx answer', UNAVAILABLE, '503']
])('after %s to discovery when the engine is built', (name, failure, says) => {
  test('the build completes and the engine logs one warning', async () => {
    const { logged } = pipelineFor(engineFor(new CountingClient(2, failure)));
    await settle();
    expect(logged.error).toEqual([]);
    expect(logged.warn).toHaveLength(1);
    expect(logged.warn[0]).toContain('tried again');
    expect(logged.warn[0]).toContain(says);
  });

  test('the first process tries discovery again', async () => {
    const client = new CountingClient(2, failure);
    const { pipeline, logged } = pipelineFor(engineFor(client));
    await settle();
    const flowData = await processOne(pipeline);
    expect(Object.keys(flowData.errors)).toEqual([]);
    expect(client.requests.sort()).toEqual(
      ['accessibleproperties', 'accessibleproperties', 'evidencekeys',
        'evidencekeys']);
    expect(logged.error).toEqual([]);
  });
});

test('a failure that arrives before the engine is in a Pipeline is logged ' +
  'by its first process', async () => {
  const engine = engineFor(new CountingClient(2, UNAVAILABLE));
  await settle();
  const { pipeline, logged } = pipelineFor(engine);
  expect(logged.warn).toEqual([]);
  const flowData = await processOne(pipeline);
  expect(Object.keys(flowData.errors)).toEqual([]);
  expect(logged.warn).toHaveLength(1);
  expect(logged.warn[0]).toContain('503');
  await processOne(pipeline);
  expect(logged.warn).toHaveLength(1);
});

test('a 4xx answer to discovery when the engine is built is logged as an ' +
  'error, not a warning', async () => {
  const { logged } = pipelineFor(engineFor(new CountingClient(2, REFUSED)));
  await settle();
  expect(logged.warn).toEqual([]);
  expect(logged.error).toHaveLength(1);
  expect(logged.error[0]).toContain('The resource key is not valid.');
});
