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

// The Data updates page of the pipeline specification says that, where no
// product is configured, the data update service asks for the product of
// the data file. Once the engine has loaded the file the product comes from
// the engine. Before then it is read from the header of the file at the
// configured location, without loading the file, and there is no product
// where the header cannot be read. These tests answer the updates from a
// stand-in for the Distributor on this machine.

const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..', '..');
const DataUpdateStandIn = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'tests', 'dataUpdateStandIn'));
const DataFileUpdateService = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'dataFileUpdateService'));
const AutoUpdateStatus = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'autoUpdateStatus'));
const DeviceDetectionOnPremisePipelineBuilder = require(path.join(__dirname,
  '..', 'deviceDetectionOnPremisePipelineBuilder'));
const DeviceDetectionDataFile = require(path.join(__dirname, '..',
  'deviceDetectionDataFile'));

const DATA = path.join(ROOT, 'cxx', 'data', 'device-detection');

// The data files the build fetches, and the product each one's header
// names. The TAC data file is linked in under this name.
const DATA_FILES = [
  ['TAC', path.join(DATA, 'Enterprise-HashV41.hash'), 'V4TAC'],
  ['Lite', path.join(DATA, '51Degrees-LiteV4.1.hash'), 'V4Lite']
];

// A product the stand-in lists before the data file's own, as the
// Distributor does for a license key that holds a Device Detection and an
// IP Intelligence product.
const OTHER_PRODUCT = 'IPIV4Enterprise';

const STAND_IN_KEY = 'STANDINLICENSEKEY000';

const DAY_MS = 24 * 60 * 60 * 1000;

// Copying, serving and loading a whole data file can take longer than the
// usual test timeout on a slow runner.
jest.setTimeout(10 * 60 * 1000);

// Builds an engine for the data file at the path, with its update URL
// pointed at the address given, and gives the data file it registers. The
// data file is not registered with a real update service, so nothing is
// downloaded while the engine is built.
const registeredDataFile = (dataFile, updateUrl) => {
  const registered = [];
  const service = new DataFileUpdateService();
  service.registerDataFile = (file) => registered.push(file);
  new DeviceDetectionOnPremisePipelineBuilder({
    dataFile,
    performanceProfile: 'LowMemory',
    shareUsage: false,
    autoUpdate: false,
    updateOnStart: Boolean(updateUrl),
    fileSystemWatcher: false,
    licenceKeys: STAND_IN_KEY,
    dataUpdateUrl: updateUrl,
    createTempDataCopy: true,
    tempDataDir: path.dirname(dataFile),
    dataFileUpdateService: service
  }).build();
  expect(registered.length).toBe(1);
  return registered[0];
};

// Runs the update on start-up of the data file with a real update service,
// and resolves with the status it ends with.
const updateOnStart = (dataFile) => new Promise((resolve) => {
  const service = new DataFileUpdateService();
  service.on('error', () => {});
  service.once('updateComplete', (status) => resolve(status));
  service.registerDataFile(dataFile);
});

// A native engine keeps its data file open until the garbage collector
// frees it, and Windows does not remove an open file. The engine of a test
// is not reachable once the test has ended, so it is collected first, where
// node was started with --expose-gc as the unit-test script starts it.
const removeFolder = (folder) => {
  if (typeof global.gc === 'function') {
    global.gc();
  }
  try {
    fs.rmSync(folder, { recursive: true, force: true });
  } catch (e) {
    // Left for the system to remove with its other temporary files.
  }
};

describe('the product read from the header of a data file', () => {
  test.each(DATA_FILES)('is %s\'s own product', (name, file, product) => {
    expect(fs.existsSync(file)).toBe(true);
    const engine = registeredDataFile(file).flowElement;

    expect(engine.swigWrapper.EngineHashSwig.getProductFromFile(file))
      .toBe(product);
  });

  test('is not there for a path with no file', () => {
    const engine = registeredDataFile(DATA_FILES[1][1]).flowElement;

    expect(() => engine.swigWrapper.EngineHashSwig.getProductFromFile(
      path.join(os.tmpdir(), 'no-such-data-file.hash'))).toThrow();
  });
});

describe('the product the data update service asks for', () => {
  let folder;
  let standIn;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'product-from-file-'));
  });

  afterEach(async () => {
    if (standIn) {
      await standIn.stop();
      standIn = undefined;
    }
    removeFolder(folder);
  });

  // The engine is built with no file at its path, so it has loaded none.
  // The data file is then put at the path, and the update on start-up must
  // ask for the product in its header. The stand-in serves a copy of the
  // file with its published date moved on a day, which the engine then
  // loads.
  test.each(DATA_FILES)(
    'with no engine is the product in the header of the %s data file ' +
    'on start-up', async (name, file, product) => {
      expect(fs.existsSync(file)).toBe(true);
      const served = path.join(folder, 'served.hash');
      fs.copyFileSync(file, served);
      const newer = new Date(
        DataUpdateStandIn.readPublished(file).getTime() + DAY_MS);
      DataUpdateStandIn.writePublished(served, newer);
      standIn = await DataUpdateStandIn.start(
        [OTHER_PRODUCT, product], served);
      const local = path.join(folder, 'local.hash');
      const dataFile = registeredDataFile(local, standIn.url);
      expect(dataFile.flowElement.engine).toBeUndefined();
      fs.copyFileSync(file, local);
      // With no engine, the update service takes the date of the local
      // file as the date of its data, so the copy is given the date the
      // data was published.
      const published = DataUpdateStandIn.readPublished(file);
      fs.utimesSync(local, published, published);

      expect(dataFile.getUpdateProduct()).toBe(product);
      expect(await updateOnStart(dataFile))
        .toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);

      expect(standIn.requests).toEqual([
        { product: null, status: 300 },
        { product, status: 200 }
      ]);
      expect(DataUpdateStandIn.readPublished(local)).toEqual(newer);
      expect(dataFile.flowElement.engine).toBeDefined();
      expect(dataFile.getUpdateProduct()).toBe(product);
    });

  // With no file and no engine there is no product, so none is asked for
  // and the update fails on the list of products.
  test('with no file is no product', async () => {
    standIn = await DataUpdateStandIn.start([OTHER_PRODUCT, 'V4TAC'], null);
    const dataFile = registeredDataFile(
      path.join(folder, 'missing.hash'), standIn.url);

    expect(dataFile.getUpdateProduct()).toBe('');
    expect(await updateOnStart(dataFile))
      .toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);

    expect(standIn.requests).toEqual([{ product: null, status: 300 }]);
    expect(dataFile.flowElement.engine).toBeUndefined();
  });

  test.each(DATA_FILES)(
    'is the product of the engine once it has loaded the %s data file',
    (name, file, product) => {
      expect(fs.existsSync(file)).toBe(true);
      const dataFile = registeredDataFile(file);
      expect(dataFile.flowElement.engine).toBeDefined();
      dataFile.getProductFromFile = jest.fn(() => 'V4Other');

      expect(dataFile.getUpdateProduct()).toBe(product);
      expect(dataFile.getProductFromFile).not.toHaveBeenCalled();
    });
});

describe('the product of a data file with no engine', () => {
  const file = DATA_FILES[1][1];
  const dataFileFor = (filePath, getProductFromFile) =>
    new DeviceDetectionDataFile({
      flowElement: {},
      path: filePath,
      updateURLParams: {},
      getProductFromFile
    });

  test('is read from the header of the file at the path', () => {
    const read = jest.fn(() => 'V4Lite');

    expect(dataFileFor(file, read).getUpdateProduct()).toBe('V4Lite');
    expect(read).toHaveBeenCalledWith(file);
  });

  test('is none where the header cannot be read', () => {
    const read = () => { throw new Error('CORRUPT_DATA'); };

    expect(dataFileFor(file, read).getUpdateProduct()).toBe('');
  });

  test('is none where there is no way to read the header', () => {
    expect(dataFileFor(file, undefined).getUpdateProduct()).toBe('');
  });

  test('is none where the header gives no tier', () => {
    expect(dataFileFor(file, () => '').getUpdateProduct()).toBe('');
    expect(dataFileFor(file, () => 'V4').getUpdateProduct()).toBe('');
  });

  test('is none where there is no path', () => {
    const read = jest.fn(() => 'V4Lite');

    expect(dataFileFor(undefined, read).getUpdateProduct()).toBe('');
    expect(read).not.toHaveBeenCalled();
  });
});
