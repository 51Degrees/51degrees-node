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

// One JSON Builder added to several Pipelines writes each Pipeline's
// elements as that Pipeline's elements describe them
// (multi-pipeline-elements.md lines 12 to 19).

const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');
const SequenceElement = require('../sequenceElement');
const JSONBundlerElement = require('../jsonbundler');

// Only the elements each test adds.
const SETTINGS = { addJavaScriptBuilder: false, useSetHeaderProperties: false };

/**
 * An element with one Property, answer.
 *
 * @param {string} dataKey the element's data key
 * @param {string} value the answer it gives
 * @param {object} propertyInfo more metadata for the Property
 * @returns {FlowElement} the element
 */
const element = (dataKey, value, propertyInfo = {}) => new FlowElement({
  dataKey,
  evidenceKeyFilter: new BasicListEvidenceKeyFilter([]),
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: { answer: value }
    }));
  },
  properties: { answer: { type: 'string', ...propertyInfo } }
});

/**
 * A Pipeline of a Sequence Element, the elements given and the JSON Builder.
 *
 * @param {JSONBundlerElement} jsonBuilder the JSON Builder
 * @param {FlowElement} flowElement the element between them
 * @returns {object} the Pipeline
 */
const build = (jsonBuilder, flowElement) => new PipelineBuilder(SETTINGS)
  .add(new SequenceElement()).add(flowElement).add(jsonBuilder).build();

const json = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  await flowData.process();
  return flowData.get('jsonbundler').get('json');
};

describe('one JSON Builder in two Pipelines', () => {
  test('writes an element only the second Pipeline holds', async () => {
    const jsonBuilder = new JSONBundlerElement();
    const first = build(jsonBuilder, element('first', 'one'));
    const second = build(jsonBuilder, element('second', 'two'));

    expect((await json(first)).first.answer).toBe('one');
    expect((await json(second)).second.answer).toBe('two');
  });

  test('marks delayed execution as each Pipeline\'s element gives it',
    async () => {
      const jsonBuilder = new JSONBundlerElement();
      const first = build(jsonBuilder, element('device', 'one'));
      const second = build(jsonBuilder,
        element('device', 'two', { delayexecution: true }));

      expect((await json(first)).device.answerdelayexecution)
        .toBeUndefined();
      expect((await json(second)).device.answerdelayexecution).toBe(true);
      expect((await json(first)).device.answerdelayexecution)
        .toBeUndefined();
    });
});
