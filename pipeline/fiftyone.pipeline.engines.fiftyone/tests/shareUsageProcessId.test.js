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

// Every record carries the process identifier the element created when it
// was built.
//
// usage-sharing-element.md at specifications 07e1fcedc2, lines 115 to 116:
// "The element MUST create a process identifier when it is built, and MUST
// write it to every record as the `ProcessId` element."
//
// Lines 128 to 131: "The identifier is never stored, so a process that starts
// again creates a new one. A process that builds more than one Usage Sharing
// Element, for example one for each of two Pipelines, creates an identifier
// for each, because the invariant values can differ between them."

const path = require('path');
const { execFileSync } = require('child_process');
const { PipelineBuilder } = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

// More records than the tests make, so nothing is sent and the queue holds
// every record written.
const PACKAGE_SIZE = 100;

// One hour in milliseconds.
const HOUR = 60 * 60 * 1000;

// A version 4 UUID in the string format of RFC 9562 section 4, in either
// letter case (lines 119 to 126).
const UUID_V4 =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

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
 * The ProcessId elements of a record.
 *
 * @param {string} record the record's XML
 * @returns {Array<string>} the text of each ProcessId element
 */
const processIdsIn = (record) => Array.from(
  record.matchAll(/<ProcessId>([^<]*)<\/ProcessId>/g), (match) => match[1]);

test('every record carries one process identifier, the same in each',
  async () => {
    const { pipeline, usageEngine } = build();

    await processRequest(pipeline);
    await processRequest(pipeline);
    clock += HOUR;
    await processRequest(pipeline);
    await processRequest(pipeline);

    expect(usageEngine.shareData.length).toBe(4);
    const ids = usageEngine.shareData.map(processIdsIn);
    for (const id of ids) {
      expect(id.length).toBe(1);
      expect(id[0]).toMatch(UUID_V4);
    }
    // Records that carry the invariant values and records that leave them
    // out are tied by the same identifier.
    expect(new Set(ids.map((id) => id[0].toLowerCase())).size).toBe(1);
  });

test('the process identifier comes first in the record', async () => {
  // The record in lines 213 to 214 starts with it.
  const { pipeline, usageEngine } = build();

  await processRequest(pipeline);

  expect(usageEngine.shareData[0]).toMatch(/^<Device><ProcessId>/);
});

test('a fresh element creates a new process identifier', async () => {
  const first = build();
  const second = build();

  await processRequest(first.pipeline);
  await processRequest(second.pipeline);

  const firstId = processIdsIn(first.usageEngine.shareData[0]);
  const secondId = processIdsIn(second.usageEngine.shareData[0]);
  expect(firstId.length).toBe(1);
  expect(secondId.length).toBe(1);
  expect(firstId[0].toLowerCase()).not.toBe(secondId[0].toLowerCase());
});

test('a process that starts again creates a new process identifier', () => {
  // Each run is a new Node.js process that builds an element, shares one
  // request and prints the identifier of its record.
  const script = `
    const { PipelineBuilder } = require('fiftyone.pipeline.core');
    const ShareUsage = require(${JSON.stringify(
      path.join(__dirname, '..', 'shareUsage'))});
    const usageEngine = new ShareUsage({
      requestedPackageSize: ${PACKAGE_SIZE},
      endpoint: 'http://127.0.0.1/'
    });
    const pipeline = new PipelineBuilder().add(usageEngine).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'user agent');
    flowData.process().then(() => {
      const match = /<ProcessId>([^<]*)<\\/ProcessId>/
        .exec(usageEngine.shareData[0] || '');
      process.stdout.write(match ? match[1] : '');
    });`;
  const run = () => execFileSync(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    encoding: 'utf8'
  }).trim();

  const first = run();
  const second = run();

  expect(first).toMatch(UUID_V4);
  expect(second).toMatch(UUID_V4);
  expect(first.toLowerCase()).not.toBe(second.toLowerCase());
}, 30000);
