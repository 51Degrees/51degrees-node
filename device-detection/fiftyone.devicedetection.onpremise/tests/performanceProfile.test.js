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

// The performance profile is Balanced unless another is chosen. The engine
// does not expose the profile it uses, so these tests watch the profile
// setter it calls on the native configuration, and read the collection
// settings that configuration holds afterwards.

const path = require('path');
const fs = require('fs');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const {
  DeviceDetectionOnPremise,
  DeviceDetectionOnPremisePipelineBuilder
} = require51('fiftyone.devicedetection.onpremise');

const LiteDataFile = path.resolve(
  process.env.directory || __dirname,
  '../../../cxx/data/device-detection/51Degrees-LiteV4.1.hash');

const haveLiteDataFile = fs.existsSync(LiteDataFile);
if (!haveLiteDataFile) {
  console.warn(
    'The performance profile tests are skipped because the free Lite ' +
    `data file is not at ${LiteDataFile}. Run ` +
    'cxx/data/get-data-files.sh or cxx/data/get-data-files.ps1 to ' +
    'download it.');
}
const describeWithLite = haveLiteDataFile ? describe : describe.skip;

// The collection settings of the native Balanced and LowMemory
// configurations, being whether each collection is loaded into memory and
// how many items its cache holds.
const BALANCED = {
  strings: [false, 10000],
  properties: [true, 0],
  values: [false, 500],
  profiles: [false, 10000],
  nodes: [false, 50000],
  profileOffsets: [false, 10000]
};
const LOW_MEMORY = {
  strings: [false, 0],
  properties: [false, 0],
  values: [false, 0],
  profiles: [false, 0],
  nodes: [false, 0],
  profileOffsets: [false, 0]
};

/**
 * The loaded and capacity settings of each collection in a native
 * configuration.
 *
 * @param {object} config the native configuration
 * @returns {object} the settings, keyed as in BALANCED
 */
function collectionSettings (config) {
  const settings = {};
  for (const name of Object.keys(BALANCED)) {
    const collection =
      config['get' + name[0].toUpperCase() + name.slice(1)]();
    // The native module answers loaded as 0 or 1.
    settings[name] =
      [Boolean(collection.getLoaded()), collection.getCapacity()];
  }
  return settings;
}

const engineOptions = {
  dataFilePath: LiteDataFile,
  autoUpdate: false,
  licenceKeys: ''
};

const builderOptions = {
  dataFile: LiteDataFile,
  licenceKeys: '',
  autoUpdate: false,
  updateOnStart: false,
  fileSystemWatcher: false,
  shareUsage: false
};

describeWithLite('performanceProfile', () => {
  let ConfigHashSwig;
  let setters;

  beforeAll(() => {
    // An engine loads the native module, which holds the configuration
    // class every later engine uses.
    ConfigHashSwig = new DeviceDetectionOnPremise(engineOptions)
      .swigWrapper.ConfigHashSwig;
  });

  beforeEach(() => {
    setters = {};
    for (const name of ['setBalanced', 'setLowMemory', 'setMaxPerformance',
      'setBalancedTemp', 'setHighPerformance']) {
      setters[name] = jest.spyOn(ConfigHashSwig.prototype, name);
    }
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  /**
   * Checks that only the Balanced setter was called, once, and that the
   * configuration it was called on holds the Balanced collection settings.
   */
  function expectBalanced () {
    for (const [name, setter] of Object.entries(setters)) {
      expect([name, setter.mock.calls.length])
        .toEqual([name, name === 'setBalanced' ? 1 : 0]);
    }
    expect(collectionSettings(setters.setBalanced.mock.contexts[0]))
      .toEqual(BALANCED);
  }

  test('an engine left at its defaults uses Balanced', () => {
    // eslint-disable-next-line no-new
    new DeviceDetectionOnPremise(engineOptions);
    expectBalanced();
  });

  test('a pipeline builder left at its defaults uses Balanced', () => {
    new DeviceDetectionOnPremisePipelineBuilder(builderOptions).build();
    expectBalanced();
  });

  test('another profile can still be chosen', () => {
    new DeviceDetectionOnPremisePipelineBuilder(
      Object.assign({ performanceProfile: 'LowMemory' }, builderOptions))
      .build();
    expect(setters.setBalanced).not.toHaveBeenCalled();
    expect(setters.setLowMemory).toHaveBeenCalledTimes(1);
    expect(collectionSettings(setters.setLowMemory.mock.contexts[0]))
      .toEqual(LOW_MEMORY);
  });
});
