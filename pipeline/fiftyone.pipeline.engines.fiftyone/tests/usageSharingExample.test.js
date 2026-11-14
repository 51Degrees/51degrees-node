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

// Runs the usage sharing example in its own process, from its own folder,
// as a person runs it. It builds a Pipeline from its 51d.json and processes
// nothing, so it shares nothing.

const childProcess = require('child_process');
const path = require('path');

const TIMEOUT_MS = 30000;

test('the usage sharing example builds its Pipeline from 51d.json', () => {
  const env = Object.assign({}, process.env);
  delete env.JEST_WORKER_ID;
  const result = childProcess.spawnSync(
    process.execPath, ['usageSharing.js'], {
      cwd: path.join(__dirname, '..', 'examples', 'usageSharing'),
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS
    });

  expect({ status: result.status, stderr: result.stderr })
    .toEqual({ status: 0, stderr: expect.any(String) });
  expect(result.stdout)
    .toContain('Pipeline created with share usage element.');
}, TIMEOUT_MS);
