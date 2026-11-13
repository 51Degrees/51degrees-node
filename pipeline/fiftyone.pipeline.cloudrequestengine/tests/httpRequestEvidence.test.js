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

// The web request the web integration adds as server.http-request is not a
// value to process, so the cloud request engine neither sends it to the
// cloud service nor lets it change its cache key.

const path = require('path');
const MockRequestClient = require('./classes/mockRequestClient');

// CloudEngine does not use relative path to import module so update the module
// lookups path here via setting of NODE_PATH environment variable.
const parentDir = path.resolve(__dirname, '../..');
process.env.NODE_PATH = parentDir + path.delimiter + process.env.NODE_PATH;
require('module').Module._initPaths();

const CloudRequestEngine = require('../cloudRequestEngine');
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));
const FlowElement = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/flowElement'));
const LruCache = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.engines/lruCache'));

// A request client that keeps what each request to the cloud service sent.
class RecordingClient extends MockRequestClient {
  constructor (options) {
    super(options);
    this.sent = [];
  }

  post (url, content, origin) {
    this.sent.push(content);
    return super.post(url, content, origin);
  }
}

/**
 * A pipeline with a cached cloud request engine, and an element of the
 * caller's own with no evidence key filter, which keeps every key.
 *
 * @returns {{client: RecordingClient, pipeline: object}} the pipeline and
 * the client its cloud request engine uses
 */
const build = () => {
  const client = new RecordingClient();
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(new CloudRequestEngine({
    resourceKey: 'AAAAAAAAAAAA',
    requestClient: client,
    cache: new LruCache({ size: 10 })
  })).add(new FlowElement({ dataKey: 'own', processInternal: () => {} }))
    .build();
  return { client, pipeline };
};

test('the web request is not sent to the cloud service', async () => {
  const { client, pipeline } = build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'agent');
  flowData.evidence.add('server.http-request', Object.freeze({
    'header.user-agent': 'agent',
    'header.x-test': 'test value'
  }));

  await flowData.process();

  expect(client.sent).toHaveLength(1);
  expect(client.sent[0]['user-agent']).toBe('agent');
  expect(Object.keys(client.sent[0])).not.toContain('http-request');
  expect(JSON.stringify(client.sent[0])).not.toContain('[object Object]');
});

test('the web request takes no part in the cache key', async () => {
  const { client, pipeline } = build();
  for (const value of ['one', 'two']) {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'agent');
    flowData.evidence.add('server.http-request',
      Object.freeze({ 'header.x-test': value }));
    await flowData.process();
  }

  expect(client.sent).toHaveLength(1);
});
