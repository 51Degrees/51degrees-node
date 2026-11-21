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

// The derived property example runs with no settings, from any folder, and
// shows the four things the pipeline specification's required examples ask
// of it (required-examples.md lines 28 to 52): a script held as text, a
// script file, a configuration file, and a missing source Property.

const childProcess = require('child_process');
const os = require('os');
const path = require('path');

// Long enough for the example to build both Pipelines and process four
// requests.
const TIMEOUT_MS = 30000;

// Jest waits this much longer than spawnSync, so that it can report a run
// spawnSync stopped.
const JEST_MARGIN_MS = 5000;

const CONFIGURED = '1. Built from derived-property-options.json';
const IN_CODE = '2. Built in code';
const NO_SOURCE = 'has no value because 1 source property was not available';

let result;

beforeAll(() => {
  // The example does not run under jest.
  const env = { ...process.env };
  delete env.JEST_WORKER_ID;
  result = childProcess.spawnSync(
    process.execPath, [path.join(__dirname, 'derivedProperty.js')], {
      cwd: os.tmpdir(),
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS
    });
}, TIMEOUT_MS + JEST_MARGIN_MS);

// The output from one heading up to the next, or to the end.
const part = (heading, next) => {
  const start = result.stdout.indexOf(heading);
  expect(start).toBeGreaterThanOrEqual(0);
  const end = next === undefined ? -1 : result.stdout.indexOf(next, start);
  return result.stdout.substring(start, end === -1 ? undefined : end);
};

test('runs with no settings and ends with status 0', () => {
  // What the example wrote to its error output is shown when it failed.
  expect({
    status: result.status,
    stderr: result.status === 0 ? '' : result.stderr
  }).toEqual({ status: 0, stderr: '' });
});

test('the configured Pipeline reads the script file it names', () => {
  expect(part(CONFIGURED, IN_CODE)).toContain('derived.ReaderEngagement: High');
});

test('a missing source Property gives no value and names it', () => {
  const configured = part(CONFIGURED, IN_CODE);
  expect(configured).toContain('derived.ReaderEngagement: no value. ' +
    `Derived property 'ReaderEngagement' ${NO_SOURCE}.`);
  expect(configured).toContain("'session.PointerMoved'");
  expect(configured).toContain('The request carried no query.pointermoved.');
});

test('the Pipeline built in code runs the file and the script held as text',
  () => {
    const inCode = part(IN_CODE);
    expect(inCode).toContain('derived.ReaderEngagement: High');
    expect(inCode).toContain('derived.ReaderEngagementIsHigh: true');
    expect(inCode).toContain('derived.ReaderEngagementIsHigh: no value. ' +
      `Derived property 'ReaderEngagementIsHigh' ${NO_SOURCE}.`);
  });

test('ends with Find out more', () => {
  expect(part(IN_CODE)).toContain('Find out more:');
});
