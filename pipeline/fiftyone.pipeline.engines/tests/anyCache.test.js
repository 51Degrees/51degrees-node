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

// Any cache that meets the simple interface, being get and put, can be used
// by an engine, whatever class it is and whatever it keeps
// (caching.md lines 86 and 87).

const path = require('path');

const Engine = require(path.resolve(__dirname, '../engine'));
const PipelineBuilder = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));
const AspectDataDictionary = require(
  path.resolve(__dirname, '../aspectDataDictionary'));
const BasicListEvidenceKeyFilter = require(
  path.resolve(__dirname, '../../fiftyone.pipeline.core/basicListEvidenceKeyFilter'));
const DataKeyedCache = require(path.resolve(__dirname, '../dataKeyedCache'));
const LruCache = require(path.resolve(__dirname, '../lruCache'));

/**
 * A Pipeline holding one engine with the cache given, which counts the
 * requests it works on, so a result served from the cache is one the engine
 * did not work for.
 *
 * @param {object} cache the cache for the engine to use
 * @returns {object} the worked list and the pipeline
 */
const engineWith = cache => {
  const worked = [];
  const engine = new Engine({
    dataKey: 'counter',
    cache,
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
    properties: { worked: { meta: { type: 'int' } } },
    processInternal: function (flowData) {
      worked.push(flowData.evidence.get('header.user-agent'));
      flowData.setElementData(new AspectDataDictionary({
        flowElement: this,
        contents: { worked: worked.length }
      }));
    }
  });
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(engine).build();
  return { worked, pipeline };
};

/**
 * Process one request and give back the count the engine answered with,
 * which is the count of the request it worked on.
 *
 * @param {object} pipeline the pipeline to process with
 * @param {string} userAgent the user agent to send
 * @returns {Promise<number>} the count in the result
 */
const workedFor = async (pipeline, userAgent) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', userAgent);
  await flowData.process();
  return flowData.get('counter').get('worked');
};

test('an engine uses a cache of the caller own making, an object with get ' +
  'and put', async () => {
  const kept = new Map();
  const calls = { get: 0, put: 0 };
  const cache = {
    get: key => {
      calls.get++;
      return kept.get(key);
    },
    put: (key, value) => {
      calls.put++;
      kept.set(key, value);
    }
  };
  const { worked, pipeline } = engineWith(cache);

  expect(await workedFor(pipeline, 'agent')).toBe(1);
  // The second request is answered from the cache, so the engine worked
  // once and the answer is the one it worked out for the first.
  expect(await workedFor(pipeline, 'agent')).toBe(1);

  expect(worked).toEqual(['agent']);
  expect(calls).toEqual({ get: 2, put: 1 });
  expect(kept.size).toBe(1);
});

test('a cache that is not the shipped class, and extends nothing, is used ' +
  'the same way', async () => {
  class OwnCache {
    constructor () {
      this.kept = new Map();
      this.gets = 0;
    }

    get (key) {
      this.gets++;
      return this.kept.get(key);
    }

    put (key, value) {
      this.kept.set(key, value);
    }
  }

  const cache = new OwnCache();
  expect(cache instanceof DataKeyedCache).toBe(false);
  expect(cache instanceof LruCache).toBe(false);
  const { worked, pipeline } = engineWith(cache);

  expect(await workedFor(pipeline, 'first')).toBe(1);
  expect(await workedFor(pipeline, 'second')).toBe(2);
  expect(await workedFor(pipeline, 'first')).toBe(1);

  expect(worked).toEqual(['first', 'second']);
  expect(cache.gets).toBe(3);
  expect(cache.kept.size).toBe(2);
});

test('a cache that keeps nothing leaves the engine working for every ' +
  'request, and is offered each result', async () => {
  const offered = [];
  const cache = {
    get: () => undefined,
    put: key => offered.push(key)
  };
  const { worked, pipeline } = engineWith(cache);

  expect(await workedFor(pipeline, 'agent')).toBe(1);
  expect(await workedFor(pipeline, 'agent')).toBe(2);

  expect(worked).toEqual(['agent', 'agent']);
  expect(offered).toHaveLength(2);
  expect(offered[0]).toBe(offered[1]);
});

test('the cache the package ships answers the same as a cache of the ' +
  'caller own making', async () => {
  const { worked, pipeline } = engineWith(new LruCache({}));

  expect(await workedFor(pipeline, 'agent')).toBe(1);
  expect(await workedFor(pipeline, 'agent')).toBe(1);

  expect(worked).toEqual(['agent']);
});
