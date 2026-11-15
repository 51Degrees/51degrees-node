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

// Runs the cloud star sign example in its own process, from its own folder,
// as a person runs it, and checks what it prints. The pipeline
// specification's required examples include a star sign Cloud Engine.

const childProcess = require('child_process');
const path = require('path');

const EXAMPLE = path.resolve(__dirname, '../examples/cloudFlowElement.js');
const TIMEOUT_MS = 30000;

test('the cloud star sign example gives each star sign from the service',
  () => {
    const env = Object.assign({}, process.env);
    delete env.JEST_WORKER_ID;
    const run = childProcess.spawnSync(
      process.execPath, [path.basename(EXAMPLE)], {
        cwd: path.dirname(EXAMPLE),
        env,
        encoding: 'utf8',
        timeout: TIMEOUT_MS
      });

    expect(run.error).toBeUndefined();
    // What the example wrote to stderr is shown when its status is wrong,
    // so a failure says why.
    expect({ status: run.status, stderr: run.stderr })
      .toEqual({ status: 0, stderr: expect.any(String) });
    expect(run.stdout).toContain(
      'Date of birth 1990-12-25, star sign capricorn');
    expect(run.stdout).toContain(
      'Date of birth 2019-09-26, star sign libra');
    expect(run.stdout).toContain(
      'No date of birth, star sign unknown (No date of birth was given.)');
    expect(run.stdout).toContain('Find out more:');
  }, TIMEOUT_MS + 5000);
