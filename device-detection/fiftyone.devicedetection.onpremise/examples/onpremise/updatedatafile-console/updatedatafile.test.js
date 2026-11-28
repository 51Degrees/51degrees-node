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

// The example names the product to download only when it is given one, so
// with none the data update service asks for the product of the data file.
// The example is run against a stand-in for the Distributor on this
// machine, which needs no real license key, so no test here reaches the
// Distributor.

const fs = require('fs');
const path = require('path');

const example = require(path.join(__dirname, 'updatedatafile.js'));

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const DataUpdateStandIn = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'tests', 'dataUpdateStandIn'));
const ExampleProcess = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'tests', 'exampleProcess'));
const DataFileUpdateService = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'dataFileUpdateService'));
const DeviceDetectionOnPremisePipelineBuilder = require(path.join(ROOT,
  'device-detection', 'fiftyone.devicedetection.onpremise',
  'deviceDetectionOnPremisePipelineBuilder'));

const KEY = 'ABCDEFGH1234';

// The license key the example sends the stand-in, which answers whatever
// key it is sent. It is long enough for the example to take it as a key.
const STAND_IN_KEY = 'STANDINLICENSEKEY000';

// A product the stand-in lists before the data file's own, as the
// Distributor does for a license key that holds a Device Detection and an
// IP Intelligence product. Its Location header then names this one.
const OTHER_PRODUCT = 'IPIV4Enterprise';

// The data file CI fetches for the run. The example refuses the free Lite
// data file, so the test needs a file the Distributor serves.
const DATA_FILE = path.join(ROOT, 'cxx', 'data', 'device-detection',
  'Enterprise-HashV41.hash');

// The two runs of the example took 25 s together on a hosted Windows
// runner, 14 s on Ubuntu and 11 s on macOS, so one run has 120 s, and the
// test a minute more to stop it and clean up.
const RUN_LIMIT_MS = 120 * 1000;
const TIMEOUT_MS = RUN_LIMIT_MS + 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

describe('the product the update example asks for', () => {
  test.each([undefined, null, ''])(
    'is not named when none is given (%p)', (product) => {
      expect(example.productSettings(KEY, product)).toEqual({});
    });

  test('is named in the update URL when V4TAC is given', () => {
    const settings = example.productSettings(KEY, 'V4TAC');

    expect(settings.dataUpdateUseUrlFormatter).toBe(false);
    const url = new URL(settings.dataUpdateUrl);
    expect(url.origin + url.pathname)
      .toBe('https://distributor.51degrees.com/api/v2/download');
    expect(url.searchParams.getAll('Product')).toEqual(['V4TAC']);
    expect(url.searchParams.get('Type')).toBe('HashV41');
    expect(url.searchParams.get('Download')).toBe('True');
    expect(url.searchParams.get('licenseKeys')).toBe(KEY);
  });

  test('is asked of another address when one is given', () => {
    const address = 'http://127.0.0.1:9/api/v2/download';

    expect(example.productSettings(KEY, undefined, address))
      .toEqual({ dataUpdateUrl: address });
    const url = new URL(
      example.productSettings(KEY, 'V4TAC', address).dataUpdateUrl);
    expect(url.origin + url.pathname).toBe(address);
    expect(url.searchParams.getAll('Product')).toEqual(['V4TAC']);
  });
});

// The product of the data file, named by the library's own rule from an
// engine that has loaded the file, such as 'V4TAC' for the TAC data file.
const dataFileProduct = () => {
  expect(fs.existsSync(DATA_FILE)).toBe(true);
  const registered = [];
  const service = new DataFileUpdateService();
  service.registerDataFile = (dataFile) => registered.push(dataFile);
  new DeviceDetectionOnPremisePipelineBuilder({
    dataFile: DATA_FILE,
    performanceProfile: 'LowMemory',
    shareUsage: false,
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false,
    dataFileUpdateService: service
  }).build();
  expect(registered.length).toBe(1);
  const product = registered[0].getUpdateProduct();
  expect(product).not.toBe('');
  return product;
};

describe('the update example against a stand-in for the Distributor', () => {
  let product;
  let newer;
  let served;
  let standIn;
  let folder;
  let running;

  // One stand-in serves both tests the same newer copy of the data file,
  // which the example only reads, so it is copied and compressed once. The
  // requests it received are cleared before each test.
  beforeAll(async () => {
    product = dataFileProduct();
    served = ExampleProcess.makeFolder(DATA_FILE);
    const servedFile = path.join(served, 'served.hash');
    fs.copyFileSync(DATA_FILE, servedFile);
    newer = new Date(
      DataUpdateStandIn.readPublished(DATA_FILE).getTime() + DAY_MS);
    DataUpdateStandIn.writePublished(servedFile, newer);
    standIn = await DataUpdateStandIn.start(
      [OTHER_PRODUCT, product], servedFile);
  }, TIMEOUT_MS);

  afterAll(() => ExampleProcess.cleanUp([
    () => standIn && standIn.stop(),
    () => served && ExampleProcess.removeFolder(served)
  ]));

  beforeEach(() => {
    folder = ExampleProcess.makeFolder(DATA_FILE);
    if (standIn) {
      standIn.requests = [];
    }
  });

  // The example is stopped before anything it holds open is removed. Its
  // data file, the copy it makes of it and its temporary copy are all in
  // the folder.
  afterEach(() => ExampleProcess.cleanUp([
    () => running && running.stop(),
    () => ExampleProcess.removeFolder(folder),
    () => { running = undefined; }
  ]));

  // Runs the example on a copy of the data file, with its update URL
  // pointed at the stand-in, which serves a copy of the data file with its
  // published date moved on a day, so it is newer than the file the
  // example starts from. Each test starts from its own copy, because the
  // example replaces it. The update has completed when the example's data
  // file holds that date. Writes the time of each step of the run, and
  // resolves with the requests the stand-in received.
  const update = async (productArgument) => {
    const dataFile = path.join(folder, path.basename(DATA_FILE));
    fs.copyFileSync(DATA_FILE, dataFile);

    running = ExampleProcess.start(path.join(__dirname, 'updatedatafile.js'), {
      dataFile,
      licenseKey: STAND_IN_KEY,
      product: productArgument,
      dataUpdateUrl: standIn.url
    }, folder, RUN_LIMIT_MS);
    await running.finished();
    process.stdout.write(running.timeline('Device Detection update example, ' +
      `product ${productArgument || 'none'}`) + '\n');
    expect(DataUpdateStandIn.readPublished(dataFile)).toEqual(newer);
    return standIn.requests;
  };

  test('with no product asks for the product of the data file', async () => {
    const requests = await update(undefined);

    // The first request names no product and gets the list. The second
    // asks for the product of the data file and gets the newer file.
    expect(requests.slice(0, 2)).toEqual([
      { product: null, status: 300 },
      { product, status: 200 }
    ]);
  }, TIMEOUT_MS);

  test('with a product asks for that product', async () => {
    const requests = await update(product);

    expect(requests[0]).toEqual({ product, status: 200 });
    expect(requests.filter((request) => request.product === null))
      .toEqual([]);
  }, TIMEOUT_MS);
});
