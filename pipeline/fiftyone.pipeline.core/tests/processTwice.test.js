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

// specifications 07e1fce, pipeline-specification/automated-testing.md lines
// 70 and 71: "For example a Flow Data can only be processed once, so there
// MUST be a test to check that an attempt to process it twice, fails."
// A second process gives a rejected promise and runs no element again,
// whether or not the first has finished, and whether or not the Pipeline
// suppresses process exceptions, which are about errors in elements.
//
// The three tests that process twice are marked failing, because today a
// second process runs every element again and resolves. Callers rely on
// that: the caching example (pipeline/fiftyone.pipeline.engines/examples/
// caching.js lines 111 to 117) adds evidence to one Flow Data and processes
// it again, and so do tests in core.test.js, logs-errors-and-stops.test.js,
// engines.test.js and cloudEngineErrorMessages.test.js. Making the second
// process fail changes what those callers get, so it waits for a release
// that says so. When it is made, remove .failing and these tests pass.

const core = require('fiftyone.pipeline.core');

// A Pipeline of one element that counts how often it runs.
const counted = (suppressProcessExceptions) => {
  const runs = { count: 0 };
  const pipeline = new core.PipelineBuilder({ suppressProcessExceptions })
    .add(new core.FlowElement({
      dataKey: 'counter',
      processInternal: function (flowData) {
        runs.count++;
        flowData.setElementData(new core.ElementDataDictionary({
          flowElement: this,
          contents: { runs: runs.count }
        }));
      }
    }))
    .build();
  return { pipeline, runs };
};

const ALREADY = 'This Flow Data has already been processed.';

// What a process gives, as text, so a test that fails says what happened
// rather than printing the Flow Data.
const outcome = (flowData) => flowData.process().then(
  () => 'resolved',
  (error) => error instanceof Error ? error.message : String(error));

describe('A Flow Data processed twice', () => {
  test.failing('fails the second time, without running the elements again',
    async () => {
      const { pipeline, runs } = counted(false);
      const flowData = pipeline.createFlowData();
      await flowData.process();
      expect(await outcome(flowData)).toBe(ALREADY);
      expect(runs.count).toBe(1);
      expect(flowData.counter.get('runs')).toBe(1);
    });

  test.failing('fails when the first process has not finished', async () => {
    const { pipeline, runs } = counted(false);
    const flowData = pipeline.createFlowData();
    const first = flowData.process();
    expect(await outcome(flowData)).toBe(ALREADY);
    await first;
    expect(runs.count).toBe(1);
  });

  test.failing('fails when the Pipeline suppresses process exceptions',
    async () => {
      const { pipeline, runs } = counted(true);
      const flowData = pipeline.createFlowData();
      await flowData.process();
      expect(await outcome(flowData)).toBe(ALREADY);
      expect(runs.count).toBe(1);
      expect(flowData.errors).toEqual({});
    });

  test('a new Flow Data from the same Pipeline is processed as usual',
    async () => {
      const { pipeline, runs } = counted(false);
      await pipeline.createFlowData().process();
      const second = pipeline.createFlowData();
      await second.process();
      expect(runs.count).toBe(2);
      expect(second.counter.get('runs')).toBe(2);
    });
});
