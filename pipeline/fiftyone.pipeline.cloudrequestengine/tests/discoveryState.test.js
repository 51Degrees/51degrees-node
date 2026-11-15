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

// An Engine can be built from a saved copy of its discovery results, the
// accepted Evidence keys and the accessible Properties, and then makes no
// discovery request. The copy is read back once discovery has answered
// (cloud-request-engine.md lines 307 to 313). Its JSON is the form the Java
// package's CloudDiscoveryState writes.

const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');
const { CloudRequestEngine, CloudEngine, CloudDiscoveryState } =
  require('../index');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));

const RESOURCE_KEY = 'AAAAAAAAAAAA';
const BASE_URL = 'https://cloud.example/api/v4/';
const UNAVAILABLE = { statusCode: 503, headers: {}, content: 'Unavailable' };

// A stand-in cloud service that records each discovery request, and fails
// them all with the failure given if there is one.
class CountingClient extends MockRequestClient {
  constructor (failure) {
    super();
    this.requests = [];
    this.failure = failure;
  }

  get (url, origin) {
    this.requests.push(url.replace(BASE_URL, '').split('?')[0]);
    return this.failure === undefined
      ? super.get(url, origin)
      : Promise.reject(this.failure);
  }
}

const engineFor = (requestClient, discoveryState) => new CloudRequestEngine({
  resourceKey: RESOURCE_KEY,
  baseURL: BASE_URL,
  requestClient,
  discoveryState
});

// Lets the stand-in's answers, and all that follows from them, finish.
const settle = () => new Promise((resolve) => setImmediate(resolve));

// The copy an engine gives once its discovery has answered.
const savedCopy = async () => {
  const engine = engineFor(new MockRequestClient());
  await settle();
  return engine.getDiscoveryState();
};

test('an engine given a saved copy makes no discovery request and is ready',
  async () => {
    const client = new CountingClient();
    const engine = engineFor(client, await savedCopy());
    expect(engine.keysAndPropertiesFetched).toBe(true);
    expect(engine.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
      .toBeTruthy();
    expect(engine.evidenceKeyFilter.filterEvidenceKey('header.anything'))
      .toBeFalsy();
    expect(Object.keys(engine.flowElementProperties.device).sort())
      .toEqual(['ismobile', 'javascripthardwareprofile',
        'screenpixelsheight', 'screenpixelswidth']);

    const device = new CloudEngine();
    device.dataKey = 'device';
    const pipeline = new PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false,
      suppressProcessExceptions: true
    }).add(engine).add(device).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'agent');
    await flowData.process();

    expect(Object.keys(flowData.errors)).toEqual([]);
    expect(flowData.get('device').get('ismobile').value).toBe(false);
    expect(Object.keys(device.properties)).toContain('ismobile');
    expect(client.requests).toEqual([]);
  });

test('the copy read back after discovery builds an engine with the same ' +
  'keys and properties', async () => {
  const first = engineFor(new MockRequestClient());
  await settle();
  const json = first.getDiscoveryState().toJson();

  const client = new CountingClient();
  const second = engineFor(client, CloudDiscoveryState.fromJson(json));
  expect(client.requests).toEqual([]);
  expect(second.flowElementProperties).toEqual(first.flowElementProperties);
  expect(second.evidenceKeyFilter.list).toEqual(first.evidenceKeyFilter.list);
  expect(second.getDiscoveryState().toJson()).toBe(json);
});

test('the copy may be given as its JSON text or as that JSON parsed, as a ' +
  'configuration file gives it', async () => {
  const json = (await savedCopy()).toJson();
  for (const discoveryState of [json, JSON.parse(json)]) {
    const client = new CountingClient();
    const engine = engineFor(client, discoveryState);
    await settle();
    expect(client.requests).toEqual([]);
    expect(engine.keysAndPropertiesFetched).toBe(true);
  }
});

test('its JSON has the evidence keys and the accessible properties answer',
  async () => {
    const saved = JSON.parse((await savedCopy()).toJson());
    expect(Object.keys(saved).sort())
      .toEqual(['accessibleProperties', 'evidenceKeys']);
    expect(saved.evidenceKeys).toContain('header.User-Agent');
    expect(Object.keys(saved.accessibleProperties.Products))
      .toEqual(['device']);
  });

test('there is no copy before discovery has answered, nor after it fails',
  async () => {
    const waiting = engineFor({
      get: () => new Promise(() => {}),
      post: () => new Promise(() => {})
    });
    expect(waiting.getDiscoveryState()).toBeUndefined();

    const failed = engineFor(new CountingClient(UNAVAILABLE));
    await settle();
    expect(failed.getDiscoveryState()).toBeUndefined();
  });

test('a copy without the evidence keys or the accessible properties answer ' +
  'is refused', () => {
  expect(() => new CloudDiscoveryState(['header.user-agent'],
    { Products: {} })).not.toThrow();
  expect(() => new CloudDiscoveryState(undefined, { Products: {} }))
    .toThrow(TypeError);
  expect(() => new CloudDiscoveryState(['header.user-agent'], '{}'))
    .toThrow(TypeError);
  expect(() => CloudDiscoveryState.fromJson('{"evidenceKeys": []}'))
    .toThrow(TypeError);
});
