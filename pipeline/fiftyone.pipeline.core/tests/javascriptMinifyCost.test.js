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

// What minifying the JavaScript Builder's script adds to each request
// (javascript-builder.md lines 109 to 114). The limit is set from a
// measurement on every runner the builds use, and each run writes what it
// measured to the log.

const PipelineBuilder = require('../pipelineBuilder');

// The most minifying may add to one request, in milliseconds, about three
// times the median of the slowest runner the builds use.
const ADDED_LIMIT_MS = 160;
// Rounds of requests, each timing a few requests with minify off and on.
const ROUNDS = 21;
const REQUESTS_PER_ROUND = 5;
const TIMEOUT_MS = 300000;

const pipelineWith = (minify) => new PipelineBuilder({
  javascriptBuilderSettings: { minify }
}).build();

// The mean time of one request, in milliseconds, script included.
const msPerRequest = async (pipeline) => {
  const start = process.hrtime.bigint();
  for (let i = 0; i < REQUESTS_PER_ROUND; i++) {
    const flowData = pipeline.createFlowData();
    await flowData.process();
    flowData.get('javascriptbuilder').get('javascript');
  }
  return Number(process.hrtime.bigint() - start) / 1e6 / REQUESTS_PER_ROUND;
};

const median = (values) => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor(sorted.length / 2)];
};

test('minifying adds less than the limit to each request', async () => {
  const plain = pipelineWith(false);
  const minified = pipelineWith(true);
  await msPerRequest(plain);
  await msPerRequest(minified);

  // The order turns each round so that neither always runs first.
  const added = [];
  const plainTimes = [];
  for (let round = 0; round < ROUNDS; round++) {
    let off;
    let on;
    if (round % 2 === 0) {
      off = await msPerRequest(plain);
      on = await msPerRequest(minified);
    } else {
      on = await msPerRequest(minified);
      off = await msPerRequest(plain);
    }
    plainTimes.push(off);
    added.push(on - off);
  }
  const sorted = [...added].sort((a, b) => a - b);
  process.stdout.write(`MINIFY_COST added median ${median(added).toFixed(3)} ` +
    `ms lowest ${sorted[0].toFixed(3)} highest ` +
    `${sorted[sorted.length - 1].toFixed(3)} with minify off ` +
    `${median(plainTimes).toFixed(3)} ms node ${process.version} ` +
    `${process.platform} ${process.arch}\n`);
  expect(median(added)).toBeLessThan(ADDED_LIMIT_MS);
}, TIMEOUT_MS);
