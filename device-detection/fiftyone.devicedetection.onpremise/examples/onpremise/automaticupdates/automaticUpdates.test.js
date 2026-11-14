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

// Runs each automatic update example in its own process, as a person runs
// it, with the data file lookup and the Pipeline builder replaced by
// stand-ins that only print what the example asked for, so the examples
// run with no data file, no network and no working licence key.
//
// With no licence key an example says it needs one and looks for no data
// file, so a fresh clone downloads nothing only to be told that. With a
// licence key it builds its Pipeline on the free Lite data file, and ends with status 0.

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DATA_FILE_PATH_VARIABLE,
  DATA_FILE_PATH_ENV_VAR,
  LEGACY_DATA_FILE_PATH_ENV_VAR
} = require(path.join(__dirname, '..', 'exampleUtils'));

const EXAMPLES = [
  'dataFileSystemWatcher.js',
  'updateOnStartUp.js',
  'updatePollingInterval.js'
];
const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';
const NEEDS_LICENCE_KEY = 'which needs a licence key';
const TIMEOUT_MS = 60000;

// The settings that name a data file or a licence key, removed so that only
// what each test sets reaches the example. The examples do not run under
// jest, so the jest variable is removed too.
const SETTINGS = [
  DATA_FILE_PATH_VARIABLE,
  DATA_FILE_PATH_ENV_VAR,
  LEGACY_DATA_FILE_PATH_ENV_VAR,
  '_51DEGREES_LICENSE_KEY',
  'LICENSE_KEY',
  'JEST_WORKER_ID'
];

// Loaded before the example. The data file lookup prints the file asked
// for and gives an empty file of that name, and the Pipeline builder prints
// the data file it was given and builds nothing.
const standInsSource = (folder) => `
const fs = require('fs');
const path = require('path');
const exampleDir = path.dirname(path.resolve(process.argv[1]));
const load = (name) => {
  try {
    return require(path.join(exampleDir, '..', '..', '..', 'node_modules', name));
  } catch (e) {
    return require(require.resolve(name, { paths: [exampleDir] }));
  }
};
const { ExampleUtils } = require(path.join(exampleDir, '..', 'exampleUtils'));
ExampleUtils.findFile = (fileName) => {
  process.stdout.write('Looked for ' + fileName + '\n');
  const file = path.join(${JSON.stringify(folder)}, fileName);
  fs.writeFileSync(file, '');
  return file;
};
load('fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder = class {
  constructor (options) {
    process.stdout.write(
      'Built a Pipeline on ' + path.basename(options.dataFile) + '\n');
  }

  build () {
    return { on () {} };
  }
};
`;

let folder;
let standIns;

beforeAll(() => {
  folder = fs.mkdtempSync(path.join(os.tmpdir(), 'automatic-updates-'));
  standIns = path.join(folder, 'standIns.js');
  fs.writeFileSync(standIns, standInsSource(folder));
});

afterAll(() => {
  fs.rmSync(folder, { recursive: true, force: true });
});

// Runs an example from its own folder with the stand-ins, the variables
// given and none of the settings above. Names are matched without regard
// to case, as Windows matches them.
const runExample = (file, variables) => {
  const remove = new Set(SETTINGS.map((name) => name.toUpperCase()));
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!remove.has(name.toUpperCase())) {
      env[name] = value;
    }
  }
  Object.assign(env, variables);
  return childProcess.spawnSync(
    process.execPath, ['--require', standIns, file], {
      cwd: __dirname,
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS
    });
};

describe.each(EXAMPLES)('%s', (file) => {
  test('with no licence key says it needs one and looks for no data file',
    () => {
      const result = runExample(file, {});

      expect({ status: result.status, stderr: result.stderr })
        .toEqual({ status: 0, stderr: expect.any(String) });
      expect(result.stdout).toContain(NEEDS_LICENCE_KEY);
      expect(result.stdout).not.toContain('Looked for');
    }, TIMEOUT_MS);

  test('with a licence key builds on the Lite data file and ends with status 0',
    () => {
      const result = runExample(file,
        { _51DEGREES_LICENSE_KEY: 'TestLicenceKey' });

      expect({ status: result.status, stderr: result.stderr })
        .toEqual({ status: 0, stderr: expect.any(String) });
      expect(result.stdout).toContain(`Looked for ${LITE_V_4_1_HASH}`);
      expect(result.stdout).toContain(`Built a Pipeline on ${LITE_V_4_1_HASH}`);
      expect(result.stdout).toContain('Exiting auto update process');
    }, TIMEOUT_MS);
});
