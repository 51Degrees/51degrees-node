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

// automated-testing.md lines 70 and 71: "a Flow Data can only be processed
// once, so there MUST be a test to check that an attempt to process it
// twice, fails."

const core = require('fiftyone.pipeline.core');

// An element that counts the requests it processes.
const counting = (state) => new core.FlowElement({
  dataKey: 'counting',
  processInternal: function (flowData) {
    state.processed += 1;
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents: { count: state.processed }
    }));
  }
});

describe('a Flow Data is processed once', () => {
  test('a second process fails and runs no element again', async () => {
    const state = { processed: 0 };
    const pipeline = new core.PipelineBuilder().add(counting(state)).build();
    const flowData = pipeline.createFlowData();

    await flowData.process();
    await expect(flowData.process())
      .rejects.toThrow('FlowData has already been processed');
    expect(state.processed).toBe(1);
    expect(flowData.counting.count).toBe(1);
  });

  test('a second process started before the first ends fails', async () => {
    const state = { processed: 0 };
    const pipeline = new core.PipelineBuilder().add(counting(state)).build();
    const flowData = pipeline.createFlowData();

    const first = flowData.process();
    await expect(flowData.process())
      .rejects.toThrow('FlowData has already been processed');
    await first;
    expect(state.processed).toBe(1);
  });

  test('each new Flow Data from the same Pipeline is processed', async () => {
    const state = { processed: 0 };
    const pipeline = new core.PipelineBuilder().add(counting(state)).build();

    await pipeline.createFlowData().process();
    await pipeline.createFlowData().process();
    expect(state.processed).toBe(2);
  });
});
