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

// The Cloud Request Engine builds its request while it processes, starts it,
// and returns without waiting for the response, which is the task of its
// 'cloud' lazy property. Every reader waits for that task, the task never
// reads the Flow Data, and a failed request is recorded once, as the Cloud
// Request Engine's error.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const { LruCache } = require('fiftyone.pipeline.engines');
const CloudRequestEngine = require('../cloudRequestEngine');
const CloudEngine = require('../cloudEngine');
const MockRequestClient = require('./classes/mockRequestClient');

// Answers the evidence keys and properties at once, and each request for
// a result only when the test says.
class HeldClient extends MockRequestClient {
  constructor () {
    super();
    this.posts = 0;
    this.held = [];
  }

  post (url, headers, data) {
    this.posts++;
    return new Promise((resolve, reject) => {
      this.held.push({ resolve, reject });
    });
  }

  answer () {
    this.held.shift().resolve(JSON.stringify(this.json));
  }

  fail (error) {
    this.held.shift().reject(error);
  }
}

// A cloud engine for the device part of the response.
const deviceEngine = (dataKey = 'device') => {
  const engine = new CloudEngine();
  engine.dataKey = dataKey;
  return engine;
};

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

describe('The Cloud Request Engine response', () => {
  test('is not waited for by the engine\'s process function', async () => {
    const client = new HeldClient();
    const engine = new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: client
    });
    const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(engine).build();
    await engine.ready();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'iPhone');
    const outcome = await Promise.race([
      engine.process(flowData).then(() => 'returned'),
      pause(500).then(() => 'still waiting')]);
    expect(outcome).toBe('returned');
    expect(client.posts).toBe(1);
    client.answer();
    expect(JSON.parse(await flowData.cloud.getAsync('cloud')))
      .toEqual(client.json);
  });

  test('is waited for by every cloud engine that reads it', async () => {
    const client = new HeldClient();
    const engine = new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: client
    });
    const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(engine)
      .add(deviceEngine())
      .build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'iPhone');
    const processing = flowData.process();
    while (client.held.length === 0) {
      await pause(5);
    }
    await pause(20);
    client.answer();
    await processing;
    expect(flowData.device.get('ismobile').value).toBe(false);
    expect(JSON.parse(flowData.cloud.get('cloud'))).toEqual(client.json);
  });

  test('is fetched by a task that does not read the Flow Data', async () => {
    const client = new HeldClient();
    client.json = Object.assign({ warnings: ['a warning'] }, client.json);
    const engine = new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: client
    });
    const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(engine).build();
    const warnings = [];
    pipeline.on('warn', (message) => warnings.push(message));
    await engine.ready();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'iPhone');
    await engine.process(flowData);
    const cloud = flowData.get('cloud');
    // Every read of the Flow Data from now on fails.
    for (const name of ['pipeline', 'evidence', 'data', 'errors']) {
      Object.defineProperty(flowData, name, {
        get () { throw new Error('the Flow Data was read'); }
      });
    }
    client.answer();
    expect(JSON.parse(await cloud.getAsync('cloud'))).toEqual(client.json);
    expect(warnings).toContain('a warning');
  });

  test('that fails is recorded once, as the Cloud Request Engine\'s error',
    async () => {
      const client = new HeldClient();
      const engine = new CloudRequestEngine({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: client
      });
      const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
        .add(engine)
        .add(deviceEngine('device'))
        .add(deviceEngine('location'))
        .build();
      pipeline.suppressProcessExceptions = true;
      pipeline.on('error', () => {});
      const flowData = pipeline.createFlowData();
      flowData.evidence.add('header.user-agent', 'iPhone');
      const processing = flowData.process();
      while (client.held.length === 0) {
        await pause(5);
      }
      client.fail({ statusCode: 500, headers: {}, content: '' });
      await processing;
      expect(Object.keys(flowData.errors)).toEqual(['cloud']);
      expect(flowData.errors.cloud).toBe(engine.errors);
      expect(() => flowData.device).toThrow();
    });

  test('that fails is not cached', async () => {
    const client = new HeldClient();
    const engine = new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      requestClient: client,
      cache: new LruCache({ size: 10 })
    });
    const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(engine).build();
    pipeline.on('error', () => {});
    await engine.ready();
    const process = async (respond) => {
      const flowData = pipeline.createFlowData();
      flowData.evidence.add('header.user-agent', 'iPhone');
      const processing = flowData.process().then(() => 'ok', () => 'failed');
      while (client.held.length === 0) {
        await pause(5);
      }
      respond();
      return processing;
    };
    expect(await process(() => client.fail({ statusCode: 500, headers: {}, content: '' })))
      .toBe('failed');
    expect(await process(() => client.answer())).toBe('ok');
    expect(client.posts).toBe(2);
  });
});
