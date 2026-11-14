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

// caching.md lines 64 to 82: cache keys are generated deterministically,
// Evidence keys are compared ignoring letter case and Evidence values with
// it.

const path = require('path');

const core = require(path.resolve(__dirname, '../../fiftyone.pipeline.core'));
const Engine = require(path.resolve(__dirname, '..', 'engine'));
const LruCache = require(path.resolve(__dirname, '..', 'lruCache'));

// A pipeline with one engine that has a cache and counts the requests it
// processes rather than serves from the cache.
const build = (state) => {
  const engine = new Engine({
    dataKey: 'counted',
    cache: new LruCache({ size: 10 }),
    evidenceKeyFilter: new core.BasicListEvidenceKeyFilter(
      ['header.user-agent', 'query.a']),
    processInternal: function (flowData) {
      state.processed += 1;
      flowData.setElementData(new core.ElementDataDictionary({
        flowElement: this,
        contents: { processed: state.processed }
      }));
    }
  });
  return new core.PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(engine).build();
};

const run = async (pipeline, entries) => {
  const flowData = pipeline.createFlowData();
  for (const [key, value] of entries) {
    flowData.evidence.add(key, value);
  }
  await flowData.process();
  return flowData;
};

describe('cache keys', () => {
  test('the same Evidence added in another order is served from the cache',
    async () => {
      const state = { processed: 0 };
      const pipeline = build(state);
      await run(pipeline, [['header.user-agent', 'UA'], ['query.a', '1']]);
      await run(pipeline, [['query.a', '1'], ['header.user-agent', 'UA']]);
      expect(state.processed).toBe(1);
    });

  test('an Evidence key in other letters is served from the cache',
    async () => {
      const state = { processed: 0 };
      const pipeline = build(state);
      await run(pipeline, [['header.User-Agent', 'UA']]);
      const second = await run(pipeline, [['header.user-agent', 'UA']]);
      expect(state.processed).toBe(1);
      expect(second.counted.processed).toBe(1);
    });

  test('an Evidence value in other letters is not', async () => {
    const state = { processed: 0 };
    const pipeline = build(state);
    await run(pipeline, [['header.user-agent', 'UA']]);
    await run(pipeline, [['header.user-agent', 'ua']]);
    expect(state.processed).toBe(2);
  });
});
