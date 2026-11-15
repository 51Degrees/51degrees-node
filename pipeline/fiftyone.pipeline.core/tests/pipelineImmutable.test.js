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

// Once built, a Pipeline cannot be changed by adding elements or removing
// them (conceptual-overview.md lines 118 and 119), whatever then happens to
// the lists it was built from.

const Pipeline = require('../pipeline');
const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');

// Only the elements each test adds.
const SETTINGS = { addJavaScriptBuilder: false, useSetHeaderProperties: false };

/**
 * An element that counts the Flow Data it processes.
 *
 * @param {string} dataKey the element's data key
 * @returns {FlowElement} the element, whose processed property holds the
 * count
 */
const counter = (dataKey) => {
  const element = new FlowElement({
    dataKey,
    evidenceKeyFilter: new BasicListEvidenceKeyFilter([]),
    processInternal: function (flowData) {
      element.processed++;
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { processed: element.processed }
      }));
    },
    properties: { processed: { type: 'int' } }
  });
  element.processed = 0;
  return element;
};

const processOnce = (pipeline) => pipeline.createFlowData().process();

describe('a built Pipeline', () => {
  test('is not changed by adding an element to its builder', async () => {
    const first = counter('first');
    const later = counter('later');
    const builder = new PipelineBuilder(SETTINGS).add(first);
    const pipeline = builder.build();

    builder.add(later);
    await processOnce(pipeline);

    expect([first.processed, later.processed]).toEqual([1, 0]);
  });

  test('is not changed by adding to parallel elements it was built with',
    async () => {
      const first = counter('first');
      const later = counter('later');
      const parallel = [first];
      const pipeline = new PipelineBuilder(SETTINGS).addParallel(parallel)
        .build();

      parallel.push(later);
      await processOnce(pipeline);

      expect([first.processed, later.processed]).toEqual([1, 0]);
    });

  test('is not changed by changing the list it was constructed with',
    async () => {
      const first = counter('first');
      const later = counter('later');
      const list = [first];
      const pipeline = new Pipeline(list);

      list.splice(0, 1, later);
      await processOnce(pipeline);

      expect([first.processed, later.processed]).toEqual([1, 0]);
    });

  test('refuses a change to its own chain of elements', async () => {
    const first = counter('first');
    const later = counter('later');
    const pipeline = new PipelineBuilder(SETTINGS).add(first)
      .addParallel([counter('parallel')]).build();

    expect(() => pipeline.flowElementsChain.push(later)).toThrow(TypeError);
    expect(() => pipeline.flowElementsChain[1].push(later))
      .toThrow(TypeError);
    await processOnce(pipeline);

    expect([first.processed, later.processed]).toEqual([1, 0]);
  });
});
