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
const IpIntelligenceOnPremisePipelineBuilder = require(path.join(ROOT,
  'ip-intelligence', 'fiftyone.ipintelligence.onpremise',
  'ipIntelligenceOnPremisePipelineBuilder'));

const KEY = 'ABCDEFGH1234';

// The license key the example sends the stand-in, which answers whatever
// key it is sent. It is long enough for the example to take it as a key.
const STAND_IN_KEY = 'STANDINLICENSEKEY000';

// A product the stand-in lists after the data file's own, as the
// Distributor does for a license key that holds a Device Detection and an
// IP Intelligence product.
const OTHER_PRODUCT = 'V4TAC';

// The data file CI fetches for the run. The example refuses a free data
// file, so the test needs a file the Distributor serves.
const DATA_FILE = path.join(ROOT, 'cxx', 'data', 'ip-intelligence',
  '51Degrees-EnterpriseIpiV41.ipi');

// Each run of the example copies the data file, which is several GB, three
// times and loads it three times. A run took 105 to 121 s on hosted Windows
// runners and about 81 s on Ubuntu, so one run has 300 s, and the test a
// minute more to stop it and clean up.
const RUN_LIMIT_MS = 300 * 1000;
const TIMEOUT_MS = RUN_LIMIT_MS + 60 * 1000;

describe('the product the update example asks for', () => {
  test.each([undefined, null, ''])(
    'is not named when none is given (%p)', (product) => {
      expect(example.productSettings(KEY, product)).toEqual({});
    });

  test('is named in the update URL when IPIV4Enterprise is given', () => {
    const settings = example.productSettings(KEY, 'IPIV4Enterprise');

    expect(settings.dataUpdateUseUrlFormatter).toBe(false);
    const url = new URL(settings.dataUpdateUrl);
    expect(url.origin + url.pathname)
      .toBe('https://distributor.51degrees.com/api/v2/download');
    expect(url.searchParams.getAll('Product')).toEqual(['IPIV4Enterprise']);
    expect(url.searchParams.get('Type')).toBe('IPIV41');
    expect(url.searchParams.get('Download')).toBe('True');
    expect(url.searchParams.get('licenseKeys')).toBe(KEY);
  });

  test('is asked of another address when one is given', () => {
    const address = 'http://127.0.0.1:9/api/v2/download';

    expect(example.productSettings(KEY, undefined, address))
      .toEqual({ dataUpdateUrl: address });
    const url = new URL(
      example.productSettings(KEY, 'IPIV4Enterprise', address).dataUpdateUrl);
    expect(url.origin + url.pathname).toBe(address);
    expect(url.searchParams.getAll('Product')).toEqual(['IPIV4Enterprise']);
  });
});

// The product of the data file, named by the library's own rule from an
// engine that has loaded the file, such as 'IPIV4Enterprise' for the
// Enterprise data file.
const dataFileProduct = () => {
  expect(fs.existsSync(DATA_FILE)).toBe(true);
  const registered = [];
  const service = new DataFileUpdateService();
  service.registerDataFile = (dataFile) => registered.push(dataFile);
  new IpIntelligenceOnPremisePipelineBuilder({
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
  // The example copies the data file beside itself before it starts.
  const copy = DATA_FILE + '.bak';
  let folder;
  let copied;
  let standIn;
  let running;

  beforeEach(() => {
    folder = ExampleProcess.makeFolder(DATA_FILE);
    copied = !fs.existsSync(copy);
  });

  // The example is stopped before anything it holds open is removed. Its
  // temporary copy of the data file is in the folder.
  afterEach(() => ExampleProcess.cleanUp([
    () => running && running.stop(),
    () => standIn && standIn.stop(),
    () => copied && fs.rmSync(copy, { force: true }),
    () => ExampleProcess.removeFolder(folder),
    () => { running = standIn = undefined; }
  ]));

  // Runs the example on the data file, with its update URL pointed at the
  // stand-in. The data file is several gigabytes, so the stand-in answers
  // a request for a product it lists with 304 rather than serving a copy,
  // and the data file is never written. The example fails when its update
  // on start-up fails, so the update has completed when it finishes.
  // Writes the time of each step of the run, and resolves with the
  // requests the stand-in received.
  const update = async (product, productArgument) => {
    standIn = await DataUpdateStandIn.start([product, OTHER_PRODUCT], null);

    running = ExampleProcess.start(path.join(__dirname, 'updatedatafile.js'), {
      dataFile: DATA_FILE,
      licenseKey: STAND_IN_KEY,
      product: productArgument,
      dataUpdateUrl: standIn.url
    }, folder, RUN_LIMIT_MS);
    await running.finished();
    process.stdout.write(running.timeline('IP Intelligence update example, ' +
      `product ${productArgument || 'none'}`) + '\n');
    return standIn.requests;
  };

  test('with no product asks for the product of the data file', async () => {
    const product = dataFileProduct();

    const requests = await update(product, undefined);

    // The first request names no product and gets the list. The second
    // asks for the product of the data file and gets 304.
    expect(requests.slice(0, 2)).toEqual([
      { product: null, status: 300 },
      { product, status: 304 }
    ]);
  }, TIMEOUT_MS);

  test('with a product asks for that product', async () => {
    const product = dataFileProduct();

    const requests = await update(product, product);

    expect(requests[0]).toEqual({ product, status: 304 });
    expect(requests.filter((request) => request.product === null))
      .toEqual([]);
  }, TIMEOUT_MS);
});
