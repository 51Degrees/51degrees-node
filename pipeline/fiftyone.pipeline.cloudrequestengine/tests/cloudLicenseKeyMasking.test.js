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

// The cloud service refuses a license key with an error that names the key,
// for example "Invalid license key(s) supplied: '<key>'". The key must reach
// no log entry, no error kept on the flow data and no rejected error in
// full, only as its last 4 characters.

const util = require('util');
const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const MockRequestClient = require('./classes/mockRequestClient');

const KEY = 'TESTKEYNOTREALABCDEFGH1234';
const MASKED = '**********************1234';
const RESOURCE = 'AQTestResourceKey';

// The answers the cloud service gives for a refused license key, and one
// for a failing status whose body is not JSON.
const ANSWERS = [
  ['an errors list', {
    statusCode: 401,
    headers: {},
    content: '{ "status":"401", "errors": ["Invalid license key(s) ' +
      'supplied: \\u0027' + KEY + '\\u0027"] }'
  }],
  ['a body that is not JSON', {
    statusCode: 500,
    headers: {},
    content: 'License ' + KEY + ' refused'
  }]
];

/**
 * Everything a value shows when it is logged or printed.
 *
 * @param {*} value the value
 * @returns {string} its text
 */
function shown (value) {
  return util.inspect(value, { depth: null, showHidden: true }) + '\n' +
    String(value);
}

/**
 * A pipeline holding a cloud request engine whose requests the cloud
 * answers with the answer given, and the log entries it writes.
 *
 * @param {object} answer the answer
 * @returns {object} the engine, the pipeline and the log entries
 */
function build (answer) {
  const engine = new CloudRequestEngine({
    resourceKey: RESOURCE,
    licenseKey: KEY,
    requestClient: new MockRequestClient({ error: answer })
  });
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(engine).build();
  const logs = [];
  for (const level of ['error', 'warn', 'info', 'debug']) {
    pipeline.on(level, (message) => logs.push(message));
  }
  return { engine, pipeline, logs };
}

describe('a license key the cloud names in its answer', () => {
  test.each(ANSWERS)('is masked when processing fails, for %s',
    async (name, answer) => {
      const { pipeline, logs } = build(answer);
      const flowData = pipeline.createFlowData();
      flowData.evidence.add('header.user-agent', 'iPhone');
      const rejection = await flowData.process().then(
        () => undefined, (error) => error);

      expect(rejection).toHaveProperty('name', 'AggregateError');
      expect(flowData.errors.cloud).toBeDefined();
      for (const [what, value] of [
        ['the log entries', logs],
        ['the flow data errors', flowData.errors],
        ['the rejected error', rejection]
      ]) {
        const text = shown(value);
        expect([what, text.includes(KEY)]).toEqual([what, false]);
        expect([what, text.includes(MASKED)]).toEqual([what, true]);
      }
      expect(flowData.errors.cloud[0].errorMessage).toContain(MASKED);
    });

  test.each(ANSWERS)('is masked when the engine cannot get ready, for %s',
    async (name, answer) => {
      const { engine, logs } = build(answer);
      const rejection = await engine.ready().then(
        () => undefined, (error) => error);

      expect(Array.isArray(rejection)).toBe(true);
      expect(logs.length).toBeGreaterThan(0);
      for (const [what, value] of [
        ['the log entries', logs],
        ['the rejected errors', rejection],
        ['the engine errors', engine.errors]
      ]) {
        const text = shown(value);
        expect([what, text.includes(KEY)]).toEqual([what, false]);
        expect([what, text.includes(MASKED)]).toEqual([what, true]);
      }
    });
});
