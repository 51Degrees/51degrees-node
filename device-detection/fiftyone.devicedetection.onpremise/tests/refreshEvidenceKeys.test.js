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

// The engine reads its accepted Evidence keys from the native engine at
// start-up and again each time its data is refreshed, as
// device-detection-on-premise.md lines 78 to 86 ask. The native engine is
// wrapped so that, after the refresh, it gives one key the data file did not
// give at start-up.

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
const NEW_KEY = 'header.x-refreshed-key';
const TIMEOUT_MS = 300000;

// The items of a list the native engine gives.
const itemsOf = (list) => {
  const items = [];
  for (let i = 0; i < list.size(); i += 1) {
    items.push(list.get(i));
  }
  return items;
};

// The native engine, but with getKeys giving the keys given.
const withKeys = (native, keys) => new Proxy(native, {
  get: (target, name) => {
    if (name === 'getKeys') {
      return () => ({ size: () => keys.length, get: (i) => keys[i] });
    }
    const value = target[name];
    return typeof value === 'function' ? value.bind(target) : value;
  }
});

describe('accepted Evidence keys', () => {
  let folder;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'refresh-keys-'));
  });

  afterEach(() => {
    fs.rmSync(folder, { recursive: true, force: true });
  });

  test('are read again when the data is refreshed', () => {
    if (!fs.existsSync(LITE)) {
      throw new Error(`No data file at '${LITE}'.`);
    }
    const file = path.join(folder, path.basename(LITE));
    fs.copyFileSync(LITE, file);

    const engine = new Engine({
      dataFilePath: file,
      performanceProfile: 'MaxPerformance',
      autoUpdate: false,
      // The test refreshes the data file itself.
      fileSystemWatcher: false,
      licenceKeys: ''
    });
    // The data file the engine registers, which the update service
    // refreshes once it has a new file.
    let dataFile;
    engine.registrationCallbacks[0]({
      dataFileUpdateService: {
        registerDataFile: (registered) => { dataFile = registered; }
      }
    });

    const keys = itemsOf(engine.engine.getKeys());
    expect(keys.length).toBeGreaterThan(0);
    for (const key of keys) {
      expect(engine.evidenceKeyFilter.filterEvidenceKey(key)).toBe(true);
    }
    expect(engine.evidenceKeyFilter.filterEvidenceKey(NEW_KEY)).toBe(false);

    engine.engine = withKeys(engine.engine, [...keys, NEW_KEY]);
    dataFile.refresh();

    expect(engine.evidenceKeyFilter.filterEvidenceKey(NEW_KEY)).toBe(true);
    expect(engine.evidenceKeyFilter.filterEvidenceKey(NEW_KEY.toUpperCase()))
      .toBe(true);
    for (const key of keys) {
      expect(engine.evidenceKeyFilter.filterEvidenceKey(key)).toBe(true);
    }
  }, TIMEOUT_MS);
});
