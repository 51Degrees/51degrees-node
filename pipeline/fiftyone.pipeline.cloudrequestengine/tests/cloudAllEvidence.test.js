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

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const MockRequestClient = require('./classes/mockRequestClient');

const testResourceKey = 'AAAAAAAAAAAA';

/**
 * A request client that keeps the body of each post, so a test can read
 * what the engine sent.
 */
class RecordingClient extends MockRequestClient {
  constructor (options) {
    super(options);
    this.posts = [];
  }

  post (url, content, origin) {
    // A license key asks for the accessible properties by post.
    if (url.toLowerCase().includes('accessibleproperties')) {
      return Promise.resolve(JSON.stringify(this.properties));
    }
    this.posts.push({ url, content });
    return super.post(url, content, origin);
  }
}

/**
 * Builds a pipeline holding the engine alone over a recording client, waits
 * for the engine to be ready, adds the evidence given, processes it and gives
 * back the body of the one post the engine made. The Set Headers Element
 * accepts every key and the JavaScript Builder every query and header key,
 * so both are left out, and the engine's own filter, being the cloud's
 * evidencekeys answer, is the only one that decides what Evidence keeps.
 *
 * @param {object} evidence the evidence keys and values to add
 * @param {object} [settings] extra engine settings
 * @returns {Promise<object>} the body the engine posted
 */
const sendEvidence = async function (evidence, settings = {}) {
  const client = new RecordingClient({});
  const engine = new CloudRequestEngine(Object.assign({
    resourceKey: testResourceKey,
    requestClient: client
  }, settings));
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(engine).build();
  // Wait for the cloud's evidencekeys answer, so the engine's filter is
  // the one a running service has when the evidence is added.
  await engine.ready();
  const flowData = pipeline.createFlowData();
  for (const [key, value] of Object.entries(evidence)) {
    flowData.evidence.add(key, value);
  }
  await flowData.process();
  expect(client.posts).toHaveLength(1);
  return client.posts[0].content;
};

// The cloud's evidencekeys answer does not list any of these names, so a
// store that keeps only the accepted keys loses all three before the engine
// reads the evidence. The Processing section of cloud-request-engine.md at
// e972d136 says the engine makes the request "with every Evidence value in
// the Flow Data, apart from the reserved names and the web request view".
test('the engine sends evidence the cloud does not list', async () => {
  const content = await sendEvidence({
    'query.my-own-thing': 'a value',
    'header.sec-ch-ua-platform': 'Windows',
    'cookie.51D_experiment': 'b'
  });

  expect(content['my-own-thing']).toBe('a value');
  expect(content['sec-ch-ua-platform']).toBe('Windows');
  expect(content['51D_experiment']).toBe('b');
});

// An accepted key is still sent, so reading the set-aside evidence as well
// has not displaced the evidence the engine sent before.
test('the engine still sends evidence the cloud lists', async () => {
  const content = await sendEvidence({
    'header.User-Agent': 'a browser',
    'query.my-own-thing': 'a value'
  });

  expect(content['User-Agent']).toBe('a browser');
  expect(content['my-own-thing']).toBe('a value');
});

// Query evidence takes precedence over header and cookie evidence of the
// same name, whether the cloud lists the name or not.
test('query evidence the cloud does not list still wins', async () => {
  const content = await sendEvidence({
    'cookie.my-own-thing': 'from the cookie',
    'header.my-own-thing': 'from the header',
    'query.my-own-thing': 'from the query'
  });

  expect(content['my-own-thing']).toBe('from the query');
});

// The service reads its credentials and the property list from these names,
// so evidence carrying one of them would sit beside the engine's own values
// with no way to know which one the service applied. The specification at
// e972d136 says evidence under any prefix whose key strips to values,
// resource, license or licence, in any letter case, MUST be left out.
test('the engine never sends a reserved name from evidence', async () => {
  const content = await sendEvidence({
    'query.resource': 'evidence_resource',
    'query.License': 'evidence_license',
    'header.LICENCE': 'evidence_licence',
    'cookie.values': 'evidence_values',
    'query.my-own-thing': 'a value'
  }, { licenseKey: 'LICENSEKEY', requestedProperties: ['IsMobile'] });

  expect(content.resource).toBe(testResourceKey);
  expect(content.license).toBe('LICENSEKEY');
  expect(content.values).toBe('IsMobile');
  expect(JSON.stringify(content)).not.toContain('evidence_');
  expect(content.licence).toBeUndefined();
  expect(content['my-own-thing']).toBe('a value');
});

// A web integration adds the web request itself under server.http-request.
// It is a view of the whole request and not a value to send, so the
// specification at e972d136 says it MUST be left out.
test('the engine never sends the web request view', async () => {
  const content = await sendEvidence({
    'server.http-request': { headers: { 'user-agent': 'a browser' } },
    'query.my-own-thing': 'a value'
  });

  expect(content['http-request']).toBeUndefined();
  expect(Object.keys(content).some(
    (name) => name.toLowerCase().includes('http-request'))).toBe(false);
  expect(content['my-own-thing']).toBe('a value');
});

// The letter case of the key does not change which name the service reads,
// so a reserved name under any prefix is left out whatever its case.
test('a reserved name is left out under any prefix and case', async () => {
  const content = await sendEvidence({
    'header.ReSoUrCe': 'evidence_resource',
    'cookie.LiCeNsE': 'evidence_license',
    'query.VALUES': 'evidence_values'
  });

  expect(JSON.stringify(content)).not.toContain('evidence_');
});

// The accepted values come first, so within a group the engine's
// addQueryData, which keeps the first value it meets for a name, takes the
// accepted one where a set aside value would give the same name.
test('the accepted evidence comes before the set aside evidence', () => {
  const engine = new CloudRequestEngine({
    resourceKey: testResourceKey,
    requestClient: new RecordingClient({})
  });
  const sendable = engine.sendableEvidence({
    getAll: () => ({ 'header.accepted': 'a', 'header.both': 'accepted' }),
    getUnaccepted: () => ({ 'header.aside': 'b', 'header.both': 'aside' })
  });

  expect(Object.keys(sendable)).toEqual(
    ['header.accepted', 'header.both', 'header.aside']);
  expect(sendable['header.both']).toBe('accepted');
});

// A name that is also a member of every object is sent like any other.
test('a key named like an object member is still sent', async () => {
  const content = await sendEvidence({
    constructor: 'a constructor',
    'query.toString': 'a string',
    valueOf: 'a value'
  });

  const own = (name) => Object.prototype.hasOwnProperty.call(content, name);
  expect(own('constructor') && content.constructor).toBe('a constructor');
  expect(own('toString') && content.toString).toBe('a string');
  expect(own('valueOf') && content.valueOf).toBe('a value');
});

// Evidence keys ignore letter case, so two spellings of one key no element
// accepts are one entry and are sent once, under the first spelling.
test('two spellings of one set aside key are sent once', async () => {
  const content = await sendEvidence({
    'header.X-Custom': 'first',
    'header.x-custom': 'second'
  });

  expect(Object.keys(content).filter(
    (name) => name.toLowerCase() === 'x-custom')).toEqual(['X-Custom']);
  expect(content['X-Custom']).toBe('second');
});
