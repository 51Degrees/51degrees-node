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

// Runs the getting started example in its own process, from its own
// folder, as a person runs it. With a resource key it must name a country
// for 8.8.8.8,
// and with none it must say how to create a key.

const childProcess = require('child_process');
const path = require('path');

const TIMEOUT_MS = 60000;
// The names the example reads its resource key from.
const KEY_NAMES = ['_51DEGREES_RESOURCE_KEY', '51' + 'DEGREES_RESOURCE_KEY',
  'RESOURCE_KEY'];

// The line the example writes after the first line that starts with the
// text given.
const answerTo = (output, question) => {
  const lines = output.split('\n').map((line) => line.trim());
  const index = lines.findIndex((line) => line.startsWith(question));
  return index === -1 ? undefined : lines[index + 1];
};

describe('Examples', () => {
  test('getting started', () => {
    const env = Object.assign({}, process.env);
    delete env.JEST_WORKER_ID;
    const result = childProcess.spawnSync(
      process.execPath, ['gettingStarted.js'], {
        cwd: __dirname,
        env,
        encoding: 'utf8',
        timeout: TIMEOUT_MS
      });

    // What the example wrote to its error output is shown when it failed.
    expect({
      status: result.status,
      stderr: result.status === 0 ? '' : result.stderr
    }).toEqual({ status: 0, stderr: '' });
    if (KEY_NAMES.some((name) => process.env[name])) {
      // The country depends on the cloud service's data, so the answer only
      // has to be a name, not a message saying why there is none.
      expect(answerTo(result.stdout,
        "Which country is the IP address '8.8.8.8' in?"))
        .toMatch(/^[A-Z][A-Za-z .'()-]{1,58}$/);
    } else {
      expect(result.stdout).toContain('You need to create a resource key');
    }
  }, TIMEOUT_MS);
});
