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

// License keys are masked where a key can reach a message, and never on the
// path a detection takes. FlowData logs on every process and on every
// element read, so a mask on the pipeline's log runs at least twice for each
// detection. These tests count the masking a detection does and fail if any
// of it comes back, whether or not a logger is attached.

const path = require('path');

const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const PipelineBuilder = require('../pipelineBuilder');
const licenseKeys = require(path.resolve(__dirname, '..', 'licenseKeys'));

const Levels = ['info', 'warn', 'error', 'debug'];
const Detections = 25;

const element = new FlowElement({
  dataKey: 'test',
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary(
      { flowElement: this, contents: { value: 1 } }));
  },
  properties: { value: { type: 'int' } }
});

/**
 * Counts the calls to the mask while the work runs. Every caller reaches the
 * mask through the module's exported function, so replacing it counts them
 * all.
 *
 * @param {Function} work the work to run, which may return a promise
 * @returns {Promise<number>} how many times the mask was called
 */
async function countMasking (work) {
  const original = licenseKeys.mask;
  let calls = 0;
  licenseKeys.mask = function () {
    calls += 1;
    return original.apply(this, arguments);
  };
  try {
    await work();
  } finally {
    licenseKeys.mask = original;
  }
  return calls;
}

/**
 * Processes evidence and reads the result, as a detection does.
 *
 * @param {Pipeline} pipeline the pipeline
 * @returns {Promise} when every detection has finished
 */
async function detect (pipeline) {
  for (let i = 0; i < Detections; i++) {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'a user agent');
    await flowData.process();
    flowData.get('test');
  }
}

test('a detection does not mask when nothing is listening', async () => {
  const pipeline = new PipelineBuilder().add(element).build();
  expect(await countMasking(() => detect(pipeline))).toBe(0);
});

test('a detection does not mask with a listener at every level', async () => {
  const pipeline = new PipelineBuilder().add(element).build();
  for (const level of Levels) {
    pipeline.on(level, () => {});
  }
  expect(await countMasking(() => detect(pipeline))).toBe(0);
});
