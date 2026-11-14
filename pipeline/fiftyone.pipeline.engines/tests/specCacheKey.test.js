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

// caching.md at 706de1f0, lines 66 and 71: "Cache keys MUST always be
// generated deterministically" and "Comparison of Evidence keys MUST be
// case-insensitive".

const path = require('path');
const Engine = require(path.resolve(__dirname, '../engine'));
const PipelineBuilder = require(path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));
const AspectDataDictionary = require(path.resolve(__dirname, '../aspectDataDictionary'));
const BasicListEvidenceKeyFilter = require(path.resolve(__dirname, '../../fiftyone.pipeline.core/basicListEvidenceKeyFilter'));
const LruCache = require(path.resolve(__dirname, '../lruCache'));

const countingPipeline = () => {
  const counter = { runs: 0 };
  const engine = new Engine({
    dataKey: 'counting',
    cache: new LruCache({ size: 10 }),
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(
      ['header.user-agent', 'header.accept-language']),
    properties: { one: { meta: { type: 'int' } } },
    processInternal: function (flowData) {
      counter.runs++;
      flowData.setElementData(new AspectDataDictionary(
        { flowElement: this, contents: { one: 1 } }));
    }
  });
  return { pipeline: new PipelineBuilder().add(engine).build(), counter };
};

const run = async (pipeline, entries) => {
  const flowData = pipeline.createFlowData();
  entries.forEach(([key, value]) => flowData.evidence.add(key, value));
  await flowData.process();
};

test('spec - the same Evidence in another order hits the cache', async () => {
  const { pipeline, counter } = countingPipeline();
  await run(pipeline, [['header.user-agent', 'a'], ['header.accept-language', 'en']]);
  await run(pipeline, [['header.accept-language', 'en'], ['header.user-agent', 'a']]);
  expect(counter.runs).toBe(1);
});

test('spec - the same Evidence in other letters hits the cache', async () => {
  const { pipeline, counter } = countingPipeline();
  await run(pipeline, [['header.user-agent', 'a']]);
  await run(pipeline, [['header.User-Agent', 'a']]);
  expect(counter.runs).toBe(1);
});
