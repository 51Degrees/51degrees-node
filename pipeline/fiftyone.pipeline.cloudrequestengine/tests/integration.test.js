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

const path = require('path');
const CloudRequestEngine = require('../cloudRequestEngine');
const keys = require('./liveCloudKeys');

// CloudEngine does not use relative path to import module so update the module
// lookups path here via setting of NODE_PATH environment variable.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const cloudEnginePath = path.resolve(__dirname, '..', 'cloudEngine');
const pipelineBuilderPath = path.resolve(__dirname, '..', '..', 'fiftyone.pipeline.core', 'pipelineBuilder');

const CloudEngine = require(cloudEnginePath);
const PipelineBuilder = require(pipelineBuilderPath);

// These tests call the live cloud service, so each fails rather than
// skips when no resource key is set.
const myResourceKey = keys.findKey(keys.RESOURCE_KEY_NAMES);

/**
 * Fails with the message for a missing key when no key is set.
 *
 * @param {string} product the product the key has to carry
 * @param {string} asksFor what the test asks the cloud service for
 */
const requireKey = function (product, asksFor) {
  if (!myResourceKey) {
    throw new Error(keys.noKeyMessage(keys.RESOURCE_KEY_NAMES, product,
      asksFor));
  }
};

/**
 * Verify that cloud engine returns isMobile property in response.
 * This is an integration test that uses the live cloud service
 * so any problems with that service could affect the result
 * of this test.
 */
test('valid response', async () => {
  requireKey('device', 'the IsMobile property of a User-Agent');
  const cloud = new CloudRequestEngine({
    resourceKey: myResourceKey,
    baseURL: 'http://cloud.51degrees.com/api/v4'
  });
  const engine = new CloudEngine();
  engine.dataKey = 'device';
  const pipeline = new PipelineBuilder()
    .add(cloud)
    .add(engine)
    .build();

  const data = pipeline.createFlowData();
  data.evidence.add('header.user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:78.0) Gecko/20100101 Firefox/78.0');
  await data.process();
  expect(data.device.ismobile.hasValue).toBe(true);
});

/**
 * Verify that making POST request with SequenceElement evidence
 * will not return any errors from cloud.
 * This is an integration test that uses the live cloud service
 * so any problems with that service could affect the result
 * of this test.
 */
test('post with sequence evidence', async () => {
  requireKey('device', 'device detection with sequence evidence');

  const cloud = new CloudRequestEngine({ resourceKey: myResourceKey });
  const engine = new CloudEngine();
  engine.dataKey = 'device';
  const pipeline = new PipelineBuilder()
    .add(cloud)
    .add(engine)
    .build();

  const data = pipeline.createFlowData();
  data.evidence.add('query.session-id', '8b5461ac-68fc-4b18-a660-7bd463b2537a');
  data.evidence.add('query.sequence', 1);
  const result = await data.process();
  expect(Object.entries(result.errors).length).toBe(0);
});

/**
 * Verify that a server using the engine gets a 51Did on its first call.
 * The engine sends the end user's User-Agent as evidence and never as its
 * own HTTP User-Agent header, so the cloud service does not treat the call
 * as a browser page that still has snippets to run. The usage is sent as
 * query.id.usage, whose name contains a dot and must reach the service
 * whole. The standard usage is a marketing one, so the key needs the
 * CloudV5FODiD product as well as FODid. This is an integration test that
 * uses the live cloud service.
 */
test('51Did on the first call', async () => {
  requireKey('FODid', 'FODiD.IdProbGlobal for the standard usage, which ' +
    'also needs the CloudV5FODiD product');
  const cloud = new CloudRequestEngine({ resourceKey: myResourceKey });
  const pipeline = new PipelineBuilder()
    .add(cloud)
    .build();
  await cloud.ready();
  // The product name keeps the case the service gives it, such as FODid.
  const fodidProduct = Object.entries(cloud.flowElementProperties)
    .find(([name]) => name.toLowerCase() === 'fodid');
  if (!fodidProduct || !fodidProduct[1].idprobglobal) {
    throw new Error(keys.missingMessage(
      'fodid.idprobglobal in the accessible properties', undefined,
      'FODid'));
  }

  const data = pipeline.createFlowData();
  data.evidence.add('header.user-agent', 'Mozilla/5.0 (Windows NT 10.0; ' +
    'Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) ' +
    'Chrome/120.0.0.0 Safari/537.36');
  data.evidence.add('server.client-ip', '81.2.69.142');
  data.evidence.add('query.id.usage', 'standard');
  await data.process();

  const fodid = JSON.parse(data.cloud.cloud).fodid;
  if (!fodid || typeof fodid.idprobglobal !== 'string' ||
    fodid.idprobglobal.length === 0) {
    throw new Error(keys.missingMessage('a 51Did for id.usage=standard',
      fodid && fodid.idprobglobalnullreason,
      fodid ? 'CloudV5FODiD' : 'FODid'));
  }
  expect(fodid.idprobglobalnullreason).toBeUndefined();
});
