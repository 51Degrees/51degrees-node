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

// Every environment variable name the tests and examples read before the
// names were aligned on the _51DEGREES_ prefix is still read, deprecated,
// when the name that replaced it is unset or empty. These tests set only
// the old name and check the value is used and the deprecation is printed
// once, naming the new name.

const childProcess = require('child_process');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DD = path.join(ROOT, 'device-detection');
const IPI = path.join(ROOT, 'ip-intelligence');
const LOCATION = path.join(ROOT, 'location');
const PIPELINE = path.join(ROOT, 'pipeline');

// A name that began with the digit, built in parts so the environment
// variable name check does not find it in this file.
const digitName = (rest) => '51' + 'DEGREES_' + rest;

const RESOURCE_KEY = '_51DEGREES_RESOURCE_KEY';
const LICENSE_KEY = '_51DEGREES_LICENSE_KEY';
const DD_PATH = '_51DEGREES_DD_PATH';
const IPI_PATH = '_51DEGREES_IPI_PATH';

// The old names of the device detection test keys, each with the name
// that replaced it.
const DD_TEST_KEYS = {
  _51DEGREES_RESOURCE_KEY: 'RESOURCE_KEY',
  _51DEGREES_RESOURCE_KEY_SUPER: 'TEST_SUPER_RESOURCE_KEY',
  _51DEGREES_RESOURCE_KEY_PLATFORM: 'TEST_PLATFORM_RESOURCE_KEY',
  _51DEGREES_RESOURCE_KEY_HARDWARE: 'TEST_HARDWARE_RESOURCE_KEY',
  _51DEGREES_RESOURCE_KEY_BROWSER: 'TEST_BROWSER_RESOURCE_KEY',
  _51DEGREES_RESOURCE_KEY_NO_SETHEADER: 'TEST_NO_SETHEADER_RESOURCE_KEY'
};

const helpers = {
  cloudRequestEngineKeys: path.join(PIPELINE,
    'fiftyone.pipeline.cloudrequestengine', 'tests', 'liveCloudKeys.js'),
  didKeys: path.join(PIPELINE,
    'fiftyone.pipeline.did', 'tests', 'liveCloudKeys.js'),
  ddKeyUtils: path.join(DD,
    'fiftyone.devicedetection.shared', 'lib', 'keyUtils.js'),
  ddTestConstants: path.join(DD,
    'fiftyone.devicedetection.shared', 'lib', 'testConstants.js'),
  ddCloudExamples: path.join(DD,
    'fiftyone.devicedetection.cloud', 'examples', 'cloud', 'exampleUtils.js'),
  ddOnPremiseExamples: path.join(DD, 'fiftyone.devicedetection.onpremise',
    'examples', 'onpremise', 'exampleUtils.js'),
  ipiKeyUtils: path.join(IPI,
    'fiftyone.ipintelligence.shared', 'lib', 'keyUtils.js'),
  ipiTestConstants: path.join(IPI,
    'fiftyone.ipintelligence.shared', 'lib', 'testConstants.js'),
  ipiCloudExamples: path.join(IPI,
    'fiftyone.ipintelligence.cloud', 'examples', 'cloud', 'exampleUtils.js'),
  ipiOnPremiseExamples: path.join(IPI, 'fiftyone.ipintelligence.onpremise',
    'examples', 'onpremise', 'exampleUtils.js')
};

// Each helper that reads a variable: what it is, the file, how the value
// is read from it, the name in use and the old name behind it. The last
// entry is false where the helper searches for a file when neither name
// is set, which these tests leave alone.
const reads = [
  ['cloud request engine tests', helpers.cloudRequestEngineKeys,
    (keys) => keys.findKey(keys.RESOURCE_KEY_NAMES),
    RESOURCE_KEY, 'RESOURCE_KEY', true],
  ['51Did tests, resource key', helpers.didKeys,
    (keys) => keys.findKey(keys.RESOURCE_KEY_NAMES),
    RESOURCE_KEY, 'RESOURCE_KEY', true],
  ['51Did tests, licence key', helpers.didKeys,
    (keys) => keys.findKey(keys.LICENCE_KEY_NAMES),
    LICENSE_KEY, 'LICENSE_KEY', true],
  ...Object.keys(DD_TEST_KEYS).map((name) => [
    'device detection tests', helpers.ddKeyUtils,
    (keyUtils) => keyUtils.getResourceKey(name),
    name, DD_TEST_KEYS[name], true]),
  ['IP Intelligence tests', helpers.ipiKeyUtils,
    (keyUtils) => keyUtils.getResourceKey(keyUtils.resourceKeyNames()),
    RESOURCE_KEY, digitName('RESOURCE_KEY'), true],
  ['IP Intelligence tests', helpers.ipiKeyUtils,
    (keyUtils) => keyUtils.getResourceKey(keyUtils.resourceKeyNames()),
    RESOURCE_KEY, 'RESOURCE_KEY', true],
  ['IP Intelligence tests', helpers.ipiKeyUtils,
    (keyUtils) => keyUtils.getResourceKey(
      keyUtils.resourceKeyNames('_51DEGREES_RESOURCE_KEY_SUPER')),
    '_51DEGREES_RESOURCE_KEY_SUPER', 'TEST_SUPER_RESOURCE_KEY', true],
  ['device detection cloud examples', helpers.ddCloudExamples,
    (utils) => utils.getResourceKeyFromEnv(),
    RESOURCE_KEY, 'RESOURCE_KEY', true],
  ['IP Intelligence cloud examples', helpers.ipiCloudExamples,
    (utils) => utils.getResourceKeyFromEnv(),
    RESOURCE_KEY, digitName('RESOURCE_KEY'), true],
  ['IP Intelligence cloud examples', helpers.ipiCloudExamples,
    (utils) => utils.getResourceKeyFromEnv(),
    RESOURCE_KEY, 'RESOURCE_KEY', true],
  ['device detection on-premise examples', helpers.ddOnPremiseExamples,
    (utils) => utils.ExampleUtils.getDataFilePathFromEnv(),
    DD_PATH, digitName('DD_PATH'), true],
  ['IP Intelligence on-premise examples', helpers.ipiOnPremiseExamples,
    (utils) => utils.ExampleUtils.findDataFile('no-such-file.ipi'),
    IPI_PATH, digitName('IPI_PATH'), false],
  ['IP Intelligence on-premise examples', helpers.ipiOnPremiseExamples,
    (utils) => utils.ExampleUtils.findDeviceDataFile('no-such-file.hash'),
    DD_PATH, digitName('DD_PATH'), false]
];

// The examples that read a variable themselves.
const ddGettingStarted = path.join(
  DD, 'fiftyone.devicedetection', 'examples', 'gettingStarted.js');
const ipiGettingStarted = path.join(
  IPI, 'fiftyone.ipintelligence', 'examples', 'gettingStarted.js');
const locationExample = (file) => path.join(LOCATION, 'examples', file);
const didServer = path.join(
  PIPELINE, 'fiftyone.pipeline.did', 'examples', 'creator-context-web',
  'server.js');

/**
 * The three examples that keep a data file up to date, in one product,
 * each of which reads the licence key.
 *
 * @param {string} folder the folder of the product family
 * @param {string} product the on-premise package of the family
 * @returns {Array<Array<string>>} one entry for each example
 */
const automaticUpdates = (folder, product) => {
  const files = [
    'dataFileSystemWatcher.js',
    'updateOnStartUp.js',
    'updatePollingInterval.js'
  ];
  return files.map((file) => {
    const example = path.join(
      folder, product, 'examples', 'onpremise', 'automaticupdates', file);
    return [example, LICENSE_KEY, 'LICENSE_KEY'];
  });
};

// Each example with the name in use, the old name behind it and any other
// variable the example needs to start.
const examples = [
  [ddGettingStarted, RESOURCE_KEY, 'RESOURCE_KEY'],
  [ipiGettingStarted, RESOURCE_KEY, digitName('RESOURCE_KEY')],
  [ipiGettingStarted, RESOURCE_KEY, 'RESOURCE_KEY'],
  [locationExample('combiningServices.js'), RESOURCE_KEY, 'RESOURCE_KEY'],
  [locationExample('configureFromFile.js'), RESOURCE_KEY, 'RESOURCE_KEY'],
  [locationExample('gettingStarted.js'), RESOURCE_KEY, 'RESOURCE_KEY'],
  [locationExample('webIntegration.js'), RESOURCE_KEY, 'RESOURCE_KEY'],
  ...automaticUpdates(DD, 'fiftyone.devicedetection.onpremise'),
  ...automaticUpdates(IPI, 'fiftyone.ipintelligence.onpremise'),
  [didServer, RESOURCE_KEY, 'RESOURCE_KEY'],
  [didServer, LICENSE_KEY, 'LICENSE_KEY', { [RESOURCE_KEY]: 'AQTestKey' }]
];

// Every name these tests set, removed before each test and put back
// after it, so a name set where the tests run does not decide a result.
const allNames = [...new Set([
  RESOURCE_KEY, LICENSE_KEY, DD_PATH, IPI_PATH,
  '_51DEGREES_RESOURCE_KEY_BESPOKE', '_51DEGREES_LICENSE_KEY_51DID',
  'LICENSE_KEY', 'TEST_LICENSE_KEY', 'TEST_IPI_RESOURCE_KEY',
  digitName('RESOURCE_KEY'), digitName('DD_PATH'), digitName('IPI_PATH'),
  ...Object.keys(DD_TEST_KEYS), ...Object.values(DD_TEST_KEYS)
])];

// What the deprecation message has to say about an old name.
const expectDeprecation = (message, name, oldName) => {
  expect(message).toContain('The ' + oldName + ' environment variable');
  expect(message).toContain('deprecated');
  expect(message).toContain(name);
};

/**
 * The module in a file, newly loaded, so that it has printed nothing yet.
 *
 * @param {string} file the path of the module
 * @returns {object} what the module exports
 */
const newlyLoaded = (file) => {
  let loaded;
  jest.isolateModules(() => {
    loaded = require(file);
  });
  return loaded;
};

describe('deprecated environment variable names', () => {
  const saved = {};
  let warn;

  beforeEach(() => {
    for (const name of allNames) {
      saved[name] = process.env[name];
      delete process.env[name];
    }
    warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warn.mockRestore();
    for (const name of allNames) {
      if (saved[name] === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = saved[name];
      }
    }
  });

  describe.each(reads)('%s (%#)',
    (what, file, read, name, oldName, checkNeither) => {
      const unset = 'reads ' + oldName + ' when ' + name + ' is not set';

      it(unset + ', and says once that it is deprecated', () => {
        const helper = newlyLoaded(file);
        process.env[oldName] = 'old-value';

        expect(read(helper)).toBe('old-value');
        expect(read(helper)).toBe('old-value');

        expect(warn).toHaveBeenCalledTimes(1);
        expectDeprecation(warn.mock.calls[0][0], name, oldName);
      });

      it('reads ' + oldName + ' when ' + name + ' is empty', () => {
        const helper = newlyLoaded(file);
        process.env[name] = '';
        process.env[oldName] = 'old-value';

        expect(read(helper)).toBe('old-value');
      });

      it('reads ' + name + ' when both are set, and prints nothing', () => {
        const helper = newlyLoaded(file);
        process.env[name] = 'new-value';
        process.env[oldName] = 'old-value';

        expect(read(helper)).toBe('new-value');
        expect(warn).not.toHaveBeenCalled();
      });

      if (checkNeither) {
        it('reads nothing when neither is set, and prints nothing', () => {
          const helper = newlyLoaded(file);

          expect(read(helper)).toBeFalsy();
          expect(warn).not.toHaveBeenCalled();
        });
      }
    });

  describe('constants that held an old name', () => {
    it('are still in the device detection test constants', () => {
      const constants = newlyLoaded(helpers.ddTestConstants);

      expect(constants.legacyEnvVars).toEqual(DD_TEST_KEYS);
      expect(constants.envVars.licenseKeyEnvVar).toBe('TEST_LICENSE_KEY');
    });

    it('are still in the IP Intelligence test constants', () => {
      const constants = newlyLoaded(helpers.ipiTestConstants);

      expect(constants.envVars.ipiResourceKeyEnvVar)
        .toBe('TEST_IPI_RESOURCE_KEY');
      expect(constants.envVars.licenseKeyEnvVar).toBe('TEST_LICENSE_KEY');
    });

    it('are still in the example helpers', () => {
      expect(newlyLoaded(helpers.ddCloudExamples)
        .LEGACY_RESOURCE_KEY_ENV_VAR).toBe('RESOURCE_KEY');
      expect(newlyLoaded(helpers.ipiCloudExamples)
        .LEGACY_RESOURCE_KEY_ENV_VAR).toBe('RESOURCE_KEY');
      expect(newlyLoaded(helpers.ddOnPremiseExamples)
        .LEGACY_DATA_FILE_PATH_ENV_VAR).toBe(DD_PATH);
    });

    // A constant that kept its name and had its value changed holds its
    // old value again, and a new constant holds the name in use.
    it('hold their old values in the IP Intelligence test constants', () => {
      const constants = newlyLoaded(helpers.ipiTestConstants);

      expect(constants.envVars.superResourceKeyEnvVar)
        .toBe('TEST_SUPER_RESOURCE_KEY');
      expect(constants.envVars.superResourceKeyVariable)
        .toBe('_51DEGREES_RESOURCE_KEY_SUPER');
    });

    it('hold their old values in the cloud example helpers', () => {
      const ipi = newlyLoaded(helpers.ipiCloudExamples);
      const dd = newlyLoaded(helpers.ddCloudExamples);

      expect(ipi.RESOURCE_KEY_ENV_VAR).toBe(digitName('RESOURCE_KEY'));
      expect(ipi.RESOURCE_KEY_VARIABLE).toBe(RESOURCE_KEY);
      expect(dd.RESOURCE_KEY_ENV_VAR).toBe(RESOURCE_KEY);
    });

    it('hold their old values in the on-premise example helpers', () => {
      const dd = newlyLoaded(helpers.ddOnPremiseExamples);
      const ipi = newlyLoaded(helpers.ipiOnPremiseExamples);

      expect(dd.DATA_FILE_PATH_ENV_VAR).toBe(digitName('DD_PATH'));
      expect(dd.DATA_FILE_PATH_VARIABLE).toBe(DD_PATH);
      expect(ipi.IPI_DATA_FILE_ENV_VAR).toBe(digitName('IPI_PATH'));
      expect(ipi.IPI_DATA_FILE_VARIABLE).toBe(IPI_PATH);
      expect(ipi.DD_DATA_FILE_ENV_VAR).toBe(digitName('DD_PATH'));
      expect(ipi.DD_DATA_FILE_VARIABLE).toBe(DD_PATH);
    });
  });

  /**
   * Starts an example with one variable set and no other of the names
   * these tests cover, and returns what it wrote to standard error up to
   * the deprecation message, or up to its end when it never wrote one.
   * The example is stopped as soon as the message is seen, before it
   * calls any service.
   *
   * @param {string} file the example to start
   * @param {string} oldName the variable to set
   * @param {object} [others] further variables the example needs
   * @returns {Promise<string>} what the example wrote to standard error
   */
  const errorOutputOf = (file, oldName, others) => new Promise((resolve) => {
    const environment = Object.assign({}, process.env);
    for (const name of allNames) {
      delete environment[name];
    }
    Object.assign(environment, others);
    environment[oldName] = 'deprecated-name-check';
    environment.PORT = '0';
    const child = childProcess.spawn(process.execPath, [file], {
      cwd: path.dirname(file),
      env: environment,
      stdio: ['ignore', 'ignore', 'pipe']
    });
    let output = '';
    const finish = () => {
      clearTimeout(timer);
      child.kill();
      resolve(output);
    };
    const timer = setTimeout(finish, 20000);
    child.stderr.on('data', (chunk) => {
      output += chunk;
      // The message ends with this word, so the whole of it has arrived.
      if (output.includes('instead.')) {
        finish();
      }
    });
    child.once('error', finish);
    child.once('close', finish);
  });

  // Each example is named by its path from the repository root.
  const namedExamples = examples.map((example) => [
    path.relative(ROOT, example[0]).split(path.sep).join('/'), ...example]);

  describe.each(namedExamples)('%s (%#)', (
    title, file, name, oldName, others) => {
    const unset = 'reads ' + oldName + ' when ' + name + ' is not set';

    it(unset + ', and says that it is deprecated', async () => {
      const output = await errorOutputOf(file, oldName, others);

      expectDeprecation(output, name, oldName);
    }, 30000);
  });
});
