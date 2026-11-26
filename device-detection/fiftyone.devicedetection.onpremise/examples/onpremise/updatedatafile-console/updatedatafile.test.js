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

const childProcess = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const example = require(path.join(__dirname, 'updatedatafile.js'));

const ROOT = path.join(__dirname, '..', '..', '..', '..', '..');
const DataUpdateStandIn = require(path.join(ROOT, 'pipeline',
  'fiftyone.pipeline.engines', 'tests', 'dataUpdateStandIn'));
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

const TIMEOUT_MS = 10 * 60 * 1000;
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

// Runs the example in its own process, so that the file watcher and the
// polling it starts end with it. The process loads the example as a module
// and runs it with the settings given, rather than as a person runs it,
// which would ask whether to go on. No license key or data file setting
// reaches it, and its temporary files go in the folder given.
const runExample = (folder, settings) => new Promise((resolve) => {
  const remove = new Set(['_51DEGREES_LICENSE_KEY', '_51DEGREES_DD_PATH']);
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!remove.has(name.toUpperCase())) {
      env[name] = value;
    }
  }
  // The example runs only its module part when this is set.
  env.JEST_WORKER_ID = env.JEST_WORKER_ID || '1';
  env.TMPDIR = env.TMP = env.TEMP = folder;
  const script = 'const s = JSON.parse(process.argv[2]);' +
    'require(process.argv[1]).run(s.dataFile, s.licenseKey, false, ' +
    'process.stdout, s.product, s.dataUpdateUrl).then(' +
    '() => process.exit(0), (e) => { console.error(e); process.exit(1); });';
  const child = childProcess.spawn(process.execPath,
    ['-e', script, path.join(__dirname, 'updatedatafile.js'),
      JSON.stringify(settings)],
    { cwd: __dirname, env });
  let output = '';
  child.stdout.on('data', (data) => { output += data; });
  child.stderr.on('data', (data) => { output += data; });
  child.on('close', (status) => resolve({ status, output }));
});

describe('the update example against a stand-in for the Distributor', () => {
  let folder;
  let standIn;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'update-example-'));
  });

  afterEach(async () => {
    if (standIn) {
      await standIn.stop();
      standIn = undefined;
    }
    fs.rmSync(folder, { recursive: true, force: true });
  });

  // Runs the example on a copy of the data file, with its update URL
  // pointed at the stand-in. The stand-in lists the data file's product
  // and serves another copy of the data file with its published date
  // moved on a day, so the copy is newer than the file the example starts
  // from. The update has completed when the example's data file holds that
  // date. Resolves with the requests the stand-in received.
  const update = async (product, productArgument) => {
    const dataFile = path.join(folder, path.basename(DATA_FILE));
    fs.copyFileSync(DATA_FILE, dataFile);
    const served = path.join(folder, 'served.hash');
    fs.copyFileSync(DATA_FILE, served);
    const newer = new Date(
      DataUpdateStandIn.readPublished(DATA_FILE).getTime() + DAY_MS);
    DataUpdateStandIn.writePublished(served, newer);
    standIn = await DataUpdateStandIn.start(
      [OTHER_PRODUCT, product], served);

    const result = await runExample(folder, {
      dataFile,
      licenseKey: STAND_IN_KEY,
      product: productArgument,
      dataUpdateUrl: standIn.url
    });

    // What the example wrote is shown when it did not finish.
    expect({
      status: result.status,
      output: result.status === 0 ? '' : result.output
    }).toEqual({ status: 0, output: '' });
    expect(DataUpdateStandIn.readPublished(dataFile)).toEqual(newer);
    return standIn.requests;
  };

  test('with no product asks for the product of the data file', async () => {
    const product = dataFileProduct();

    const requests = await update(product, undefined);

    // The first request names no product and gets the list. The second
    // asks for the product of the data file and gets the newer file.
    expect(requests.slice(0, 2)).toEqual([
      { product: null, status: 300 },
      { product, status: 200 }
    ]);
  }, TIMEOUT_MS);

  test('with a product asks for that product', async () => {
    const product = dataFileProduct();

    const requests = await update(product, product);

    expect(requests[0]).toEqual({ product, status: 200 });
    expect(requests.filter((request) => request.product === null))
      .toEqual([]);
  }, TIMEOUT_MS);
});
