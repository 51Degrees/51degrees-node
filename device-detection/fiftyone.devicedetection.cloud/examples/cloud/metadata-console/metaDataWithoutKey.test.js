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

// Runs the example as a person runs it with no resource key, which needs
// no cloud service, and checks what it says.

const childProcess = require('child_process');
const path = require('path');

const {
  RESOURCE_KEY_ENV_VAR,
  LEGACY_RESOURCE_KEY_ENV_VAR
} = require(path.join(__dirname, '..', 'exampleUtils'));

// The example does not run under jest, so the jest variable is removed with
// the resource key names. Names are matched without regard to case, as
// Windows matches them.
const REMOVE = new Set([
  RESOURCE_KEY_ENV_VAR, LEGACY_RESOURCE_KEY_ENV_VAR, 'JEST_WORKER_ID'
].map((name) => name.toUpperCase()));

describe('Examples', () => {
  test('cloud metadata with no resource key says what it needs', () => {
    const env = {};
    for (const [name, value] of Object.entries(process.env)) {
      if (!REMOVE.has(name.toUpperCase())) {
        env[name] = value;
      }
    }
    const result = childProcess.spawnSync(
      process.execPath, ['metaData.js'], {
        cwd: __dirname,
        env,
        encoding: 'utf8',
        timeout: 60000
      });

    expect(result.status).toBe(0);
    expect(result.stderr)
      .toContain(`the environment variable '${RESOURCE_KEY_ENV_VAR}'`);
    expect(result.stderr).not.toContain('the the ');
    // The message once named a different example.
    expect(result.stderr).not.toContain('Native model lookup');
  }, 60000);
});
