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

// Every test run makes a Node deprecation an error, in the Jest process and
// in the Node processes the tests start, such as the examples.

const childProcess = require('child_process');

// Calls a function deprecated for this test, as code calling a deprecated
// Node API does.
const CALL_DEPRECATED =
  "require('util').deprecate(() => {}, 'deprecated for the test', " +
  "'TESTDEP')();";

// A deprecation in the Jest process is thrown on the next tick, which stops
// the run, so the test reads the setting rather than calling one.
test('the Jest process makes a deprecation an error', () => {
  expect(process.throwDeprecation).toBe(true);
});

test('a deprecation in a Node process a test starts stops it', () => {
  const result = childProcess.spawnSync(process.execPath,
    ['-e', CALL_DEPRECATED], { encoding: 'utf8' });
  expect(result.status).not.toBe(0);
  expect(result.stderr).toContain('deprecated for the test');
});
