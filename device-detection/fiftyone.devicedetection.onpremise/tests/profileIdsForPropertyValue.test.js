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

// The ids of the profiles that hold a value of a Property
// (device-detection-on-premise.md lines 477 to 499). The engine gives them
// from the native lookup, matching the name and the value exactly, in
// ascending order with each id once. A Property named in the
// indexedProperties option is found through the native index, which gives
// the same ids as reading every profile.

const fs = require('fs');
const os = require('os');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const Engine = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremise;

const LITE = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'device-detection', '51Degrees-LiteV4.1.hash');
const TIMEOUT_MS = 300000;

// The native module for this system.
const MODULE = path.join(__dirname, '..', 'build',
  'FiftyOneDeviceDetectionHashV4-' + os.platform() + '-' + process.arch +
  '-' + process.versions.node.split('.')[0] + '.node');

// A Property of the free data file with many values.
const PROPERTY = 'BrowserName';

// An engine on the Lite data file with the options given.
const build = (options) => new Engine({
  dataFilePath: LITE,
  autoUpdate: false,
  fileSystemWatcher: false,
  licenceKeys: '',
  ...options
});

// The items of a native vector as an array.
const itemsOf = (vector) => {
  const items = [];
  for (let i = 0; i < vector.size(); i++) {
    items.push(vector.get(i));
  }
  return items;
};

// Every value the data file holds for the Property.
const valuesOf = (engine, propertyName) => {
  const metadata = engine.engine.getMetaData();
  const property = metadata.getProperties().getByKey(propertyName);
  const values = metadata.getValuesForProperty(property);
  const names = [];
  for (let i = 0; i < values.getSize(); i++) {
    names.push(values.getByIndex(i).getName());
  }
  return names;
};

// The ids the engine gives for each value.
const idsOf = (engine, values) => new Map(values.map((value) =>
  [value, engine.profileIdsForPropertyValue(PROPERTY, value)]));

// Each lookup without the index reads every profile of the data file, so
// that engine is asked for every so many values only, and each engine's ids
// are checked against a native lookup of its own on those values.
const SAMPLE_EVERY = 25;

beforeAll(() => {
  if (!fs.existsSync(LITE)) {
    throw new Error(`No data file at '${LITE}'.`);
  }
});

describe('The profile ids for a value', () => {
  let plain;
  let indexed;
  let sample;
  let fromEvery;
  let fromIndex;

  beforeAll(() => {
    plain = build({});
    indexed = build({ indexedProperties: [PROPERTY] });
    const values = valuesOf(plain, PROPERTY);
    sample = values.filter((value, i) => i % SAMPLE_EVERY === 0);
    fromEvery = idsOf(plain, sample);
    fromIndex = idsOf(indexed, values);
  }, TIMEOUT_MS);

  describe.each([
    ['read from every profile', () => plain, () => fromEvery],
    ['found through the native index', () => indexed, () => fromIndex]
  ])('of a Property %s', (label, engineOf, givenOf) => {
    test('are those of the native lookup', () => {
      const native = engineOf().engine;
      const given = givenOf();
      expect(sample.length).toBeGreaterThan(1);
      for (const value of sample) {
        expect([value, given.get(value)]).toEqual([value,
          itemsOf(native.getProfileIdsForPropertyValue(PROPERTY, value))]);
      }
      expect([...given.values()].filter((ids) => ids.length > 1).length)
        .toBeGreaterThan(0);
    }, TIMEOUT_MS);

    test('are in ascending order with each id once', () => {
      for (const ids of givenOf().values()) {
        expect(ids).toEqual([...new Set(ids)].sort((a, b) => a - b));
      }
    }, TIMEOUT_MS);

    test('match the value exactly', () => {
      // A value held by some profile whose spelling in capitals the data
      // file does not hold.
      const given = givenOf();
      const value = [...given.keys()].find((v) => given.get(v).length > 0 &&
        v.toUpperCase() !== v && !fromIndex.has(v.toUpperCase()));
      expect(engineOf().profileIdsForPropertyValue(PROPERTY,
        value.toUpperCase())).toEqual([]);
    }, TIMEOUT_MS);

    test('match the Property name exactly', () => {
      const given = givenOf();
      const value = [...given.keys()].find((v) => given.get(v).length > 0);
      expect(engineOf().profileIdsForPropertyValue(PROPERTY.toLowerCase(),
        value)).toEqual([]);
    }, TIMEOUT_MS);
  });

  test('are the same through the native index as from every profile', () => {
    for (const value of sample) {
      expect([value, fromIndex.get(value)])
        .toEqual([value, fromEvery.get(value)]);
    }
  }, TIMEOUT_MS);
});

describe('The indexedProperties option', () => {
  const ConfigHash = require(MODULE).ConfigHashSwig;
  let setIndexed;

  beforeEach(() => {
    setIndexed = jest.spyOn(ConfigHash.prototype, 'setIndexedProperties');
  });

  afterEach(() => {
    setIndexed.mockRestore();
  });

  // The names the native configuration was given, one list per call.
  const named = () => setIndexed.mock.calls.map(([list]) => itemsOf(list));

  test('names the Properties the native engine indexes', () => {
    build({ indexedProperties: ['BrowserName', 'PlatformName'] });
    expect(named()).toEqual([['BrowserName', 'PlatformName']]);
  }, TIMEOUT_MS);

  test('takes one comma separated string, as a configuration file gives',
    () => {
      build({ indexedProperties: 'BrowserName, PlatformName' });
      expect(named()).toEqual([['BrowserName', 'PlatformName']]);
    }, TIMEOUT_MS);

  test('indexes nothing when it is not given', () => {
    build({});
    expect(named()).toEqual([]);
  }, TIMEOUT_MS);
});
