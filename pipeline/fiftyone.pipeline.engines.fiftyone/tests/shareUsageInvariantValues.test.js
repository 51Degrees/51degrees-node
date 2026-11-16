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

// The values that do not change while the element lives are written to its
// first record, and again each hour, and to no other record.
//
// usage-sharing-element.md at specifications 07e1fcedc2, lines 150 to 153:
// "The invariant values MUST be written to the first record the element
// writes. They MUST be written again to the first record the element writes
// once an hour or more has passed since it last wrote them. They MUST NOT be
// written to any other record."
//
// The tests set the element's clock, ShareUsage.now, rather than wait an
// hour.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// More records than the tests make, so nothing is sent and the queue holds
// every record written.
const PACKAGE_SIZE = 100;

// One hour in milliseconds.
const HOUR = 60 * 60 * 1000;

// The elements that hold the invariant values (lines 138 to 145 and 209 to
// 210 of the specification).
const INVARIANT_ELEMENTS = [
  'Version',
  'Product',
  'FlowElement',
  'Package',
  'Language',
  'LanguageVersion',
  'ServerIP',
  'Platform'
];

// The clock the element reads while a test runs, in milliseconds.
let clock;
const originalNow = ShareUsage.now;

beforeEach(() => {
  clock = 1000;
  ShareUsage.now = () => clock;
});

afterEach(() => {
  ShareUsage.now = originalNow;
});

/**
 * Builds a Pipeline with a usage sharing element that keeps every record in
 * its queue.
 *
 * @returns {object} the Pipeline and the element
 */
const build = () => {
  const usageEngine = new ShareUsage({
    requestedPackageSize: PACKAGE_SIZE,
    endpoint: 'http://127.0.0.1/'
  });
  const pipeline = new PipelineBuilder().add(usageEngine).build();
  return { pipeline, usageEngine };
};

// Each request has its own user agent, so none is held back as a repeat.
let request = 0;

/**
 * Processes one request that is shared.
 *
 * @param {object} pipeline the Pipeline
 * @returns {Promise} resolved once processed
 */
const processRequest = (pipeline) => {
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', `user agent ${request++}`);
  return flowData.process();
};

/**
 * The invariant elements a record holds.
 *
 * @param {string} record the record's XML
 * @returns {Array<string>} the names of the invariant elements in it
 */
const invariantsIn = (record) => INVARIANT_ELEMENTS.filter(
  (name) => new RegExp(`<${name}[ >]`).test(record));

test('the first record carries every invariant value', async () => {
  const { pipeline, usageEngine } = build();

  await processRequest(pipeline);

  expect(usageEngine.shareData.length).toBe(1);
  expect(invariantsIn(usageEngine.shareData[0])).toEqual(INVARIANT_ELEMENTS);
});

test('the records after the first carry no invariant value within the hour',
  async () => {
    const { pipeline, usageEngine } = build();

    await processRequest(pipeline);
    clock += 1;
    await processRequest(pipeline);
    clock += HOUR / 2;
    await processRequest(pipeline);

    expect(usageEngine.shareData.length).toBe(3);
    expect(invariantsIn(usageEngine.shareData[1])).toEqual([]);
    expect(invariantsIn(usageEngine.shareData[2])).toEqual([]);
    // The rest of the record is still written.
    expect(usageEngine.shareData[1]).toContain('<Header Name="user-agent">');
    expect(usageEngine.shareData[1]).toContain('<DateSent>');
  });

test('the invariant values are written again once the hour is up',
  async () => {
    const { pipeline, usageEngine } = build();

    await processRequest(pipeline);
    clock += HOUR - 1;
    await processRequest(pipeline);
    clock += 1;
    await processRequest(pipeline);
    await processRequest(pipeline);

    expect(usageEngine.shareData.length).toBe(4);
    // Just under an hour after they were written, they are left out.
    expect(invariantsIn(usageEngine.shareData[1])).toEqual([]);
    // An hour after, the first record written carries them, and the next
    // does not.
    expect(invariantsIn(usageEngine.shareData[2]))
      .toEqual(INVARIANT_ELEMENTS);
    expect(invariantsIn(usageEngine.shareData[3])).toEqual([]);
  });

test('the hour runs from when the values were last written', async () => {
  // Lines 151 to 152: "once an hour or more has passed since it last wrote
  // them", so with no record for more than an hour the next one carries them.
  const { pipeline, usageEngine } = build();

  await processRequest(pipeline);
  clock += 3 * HOUR;
  await processRequest(pipeline);
  clock += HOUR - 1;
  await processRequest(pipeline);

  expect(invariantsIn(usageEngine.shareData[1])).toEqual(INVARIANT_ELEMENTS);
  expect(invariantsIn(usageEngine.shareData[2])).toEqual([]);
});

test('a record dropped from a full queue does not use up the invariant values',
  async () => {
    // Only a record the element writes counts, so the values are not lost
    // with a record that was never written.
    const usageEngine = new ShareUsage({
      requestedPackageSize: 1,
      maximumQueueSize: 1,
      endpoint: 'http://127.0.0.1/'
    });
    const pipeline = new PipelineBuilder().add(usageEngine).build();
    // Hold the queue full, with sending stopped, so the next record is
    // dropped.
    usageEngine.sending = true;
    usageEngine.shareData.push('<Device></Device>');
    await processRequest(pipeline);
    expect(usageEngine.shareData.length).toBe(1);
    usageEngine.shareData.length = 0;

    await processRequest(pipeline);

    expect(usageEngine.shareData.length).toBe(1);
    expect(invariantsIn(usageEngine.shareData[0]))
      .toEqual(INVARIANT_ELEMENTS);
  });
