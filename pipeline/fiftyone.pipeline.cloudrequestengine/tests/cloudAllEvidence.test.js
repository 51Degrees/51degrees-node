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
    this.posts.push({ url, content });
    return super.post(url, content, origin);
  }
}

/**
 * Builds a cloud-only pipeline over a recording client, waits for the engine
 * to be ready, adds the evidence given, processes it and gives back the
 * body of the one post the engine made.
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
  const pipeline = new PipelineBuilder().add(engine).build();
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
