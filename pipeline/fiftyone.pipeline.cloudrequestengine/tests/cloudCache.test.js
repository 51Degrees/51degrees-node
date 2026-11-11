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

// A result that holds a value created for one request, such as a 51Did,
// must never be stored in the cache or served from it.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const { LruCache, AspectDataDictionary } = require('fiftyone.pipeline.engines');
const CloudRequestEngine = require('../cloudRequestEngine');
const MockRequestClient = require('./classes/mockRequestClient');

const baseJson = {
  device: { ismobile: false },
  javascriptProperties: []
};

// Answers each request with the next body, and counts the requests.
class CountingClient extends MockRequestClient {
  constructor (bodies) {
    super({ json: bodies[0] });
    this.bodies = bodies;
    this.posts = 0;
  }

  post (url, headers, data) {
    this.json = this.bodies[Math.min(this.posts, this.bodies.length - 1)];
    this.posts++;
    return super.post(url, headers, data);
  }
}

const request = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.User-Agent', 'iPhone');
  await flowData.process();
  return JSON.parse(flowData.cloud.cloud);
};

// No Sequence Element, which would give each request a new session id and
// so a new cache key, because the engine has not fetched its evidence keys.
const build = (client) => new PipelineBuilder({ addSequenceElement: false })
  .add(new CloudRequestEngine({
    resourceKey: 'AAAAAAAAAAAA',
    requestClient: client,
    cache: new LruCache({ size: 10 })
  })).build();

describe('cloud request engine cache', () => {
  // A default pipeline, with the Sequence Element giving each request a
  // new session id. Once the engine has its evidence keys, as it does when
  // a cloud engine is added, the cache key is built from those keys alone,
  // so the session id does not stop a repeated request being served.
  test('serves a repeated request from the cache in a default pipeline',
    async () => {
      const client = new CountingClient([baseJson]);
      const engine = new CloudRequestEngine({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: client,
        cache: new LruCache({ size: 10 })
      });
      const pipeline = new PipelineBuilder().add(engine).build();
      await engine.ready();
      const sessions = [];
      for (let i = 0; i < 2; i++) {
        const flowData = pipeline.createFlowData();
        flowData.evidence.add('header.User-Agent', 'iPhone');
        await flowData.process();
        sessions.push(flowData.evidence.get('query.session-id'));
      }
      expect(typeof sessions[0]).toBe('string');
      expect(sessions[0]).not.toBe(sessions[1]);
      expect(client.posts).toBe(1);
    });

  test('serves a response with no 51Did from the cache', async () => {
    const client = new CountingClient([baseJson]);
    const pipeline = build(client);
    await request(pipeline);
    await request(pipeline);
    expect(client.posts).toBe(1);
  });

  test('does not store or serve a response with a top level fodid',
    async () => {
      const client = new CountingClient([
        { ...baseJson, fodid: 'first' },
        { ...baseJson, fodid: 'second' }
      ]);
      const pipeline = build(client);
      const first = await request(pipeline);
      const second = await request(pipeline);
      expect(client.posts).toBe(2);
      expect(first.fodid).toBe('first');
      expect(second.fodid).toBe('second');
    });

  // The specification says the member name is matched in any case.
  test.each(['FodId', 'FODID'])(
    'does not store or serve a response with a top level %s',
    async (name) => {
      const client = new CountingClient([
        { ...baseJson, [name]: 'first' },
        { ...baseJson, [name]: 'second' }
      ]);
      const pipeline = build(client);
      const first = await request(pipeline);
      const second = await request(pipeline);
      expect(client.posts).toBe(2);
      expect(first[name]).toBe('first');
      expect(second[name]).toBe('second');
    });

  test('does not serve a response with a fodid that it finds in the cache',
    async () => {
      const client = new CountingClient([baseJson]);
      const cache = new LruCache({ size: 10 });
      const engine = new CloudRequestEngine({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: client,
        cache
      });
      const pipeline = new PipelineBuilder({ addSequenceElement: false })
        .add(engine).build();
      const flowData = pipeline.createFlowData();
      flowData.evidence.add('header.User-Agent', 'iPhone');
      const key = JSON.stringify(engine.evidenceKeyFilter
        .filterEvidence(flowData.evidence.getAll()));
      cache.put(key, new AspectDataDictionary({
        flowElement: engine,
        contents: { cloud: JSON.stringify({ ...baseJson, fodid: 'stale' }) }
      }));
      await flowData.process();
      expect(client.posts).toBe(1);
      expect(JSON.parse(flowData.cloud.cloud)).toEqual(baseJson);
    });

  test('caches a response that has a fodid below the top level',
    async () => {
      const client = new CountingClient([
        { ...baseJson, device: { ismobile: false, fodid: 'inner' } }
      ]);
      const pipeline = build(client);
      await request(pipeline);
      await request(pipeline);
      expect(client.posts).toBe(1);
    });
});
