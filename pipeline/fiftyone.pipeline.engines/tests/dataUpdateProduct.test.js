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

// License keys can hold several products. The Distributor then answers a
// request that names no product with 300 and a URI for each product. The
// data update service reads the product of the loaded data file from that
// list and sends its first request again with the product added. These
// tests run against a stand-in for the Distributor, so they need no license
// key.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const { LicenseKeys } = require('fiftyone.pipeline.core');
const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));
const DeviceDetectionDataFile = require(path.resolve(__dirname, '..', '..',
  '..', 'device-detection', 'fiftyone.devicedetection.onpremise',
  'deviceDetectionDataFile'));
const IpIntelligenceDataFile = require(path.resolve(__dirname, '..', '..',
  '..', 'ip-intelligence', 'fiftyone.ipintelligence.onpremise',
  'ipIntelligenceDataFile'));

const KEY = 'ABCDEFGH1234';
const NEW_DATA = 'version 2';
// Each error of a check is logged after these words.
const CHECK_ERROR = 'Error during check for data update. Error detail: ';
const QUERY = '/api/v2/download?Type=HashV41&Download=True' +
  '&licenseKeys=' + KEY;
const QUERY_WITH_PRODUCT = '/api/v2/download?Type=HashV41&Download=True' +
  '&licenseKeys=' + KEY + '&Product=V4TAC';

class TestEngine {
  constructor () {
    this.dataKey = 'testEngine';
  }
}

// Stands in for the Distributor with license keys that hold the products
// given. A request that names one of them gets the data. One that names no
// product gets the data when the keys hold one product, and otherwise 300
// with a URI for each product. A request for any other product gets 403.
// The URIs are at another address and have no Download parameter, so a
// request that followed one would not arrive here. The URL and the
// If-Modified-Since header of each request are kept.
//
// The options change the answers. 'body' is sent with the 300 in place of
// the list, 'uris' are listed in place of one for each product, 'always300'
// answers 300 to a request that names a product too, 'notModified'
// answers 304 to one, and 'cutShort' closes the connection part way through
// the 300.
const distributor = (products, options = {}) => new Promise((resolve) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push({
      url: request.url,
      modifiedSince: request.headers['if-modified-since']
    });
    const asked = new URL(request.url, 'http://127.0.0.1');
    const product = asked.searchParams.get('Product');
    const multipleChoices = () => {
      if (options.cutShort) {
        // The start of a list, and then the connection closes.
        response.writeHead(300, { 'content-length': '1000' });
        response.write('{"AvailableUris":[');
        setTimeout(() => request.socket.destroy(), 50);
        return;
      }
      response.statusCode = 300;
      response.setHeader('Content-Type', 'application/json');
      if (options.location) {
        response.setHeader('Location', options.location);
      }
      response.end(options.body !== undefined
        ? options.body
        : JSON.stringify({
          AvailableUris: options.uris || products.map((name) =>
            'http://127.0.0.1:9/api/v2/download?LicenseKeys=' + KEY +
            '&LicenceKeys=&Type=' + asked.searchParams.get('Type') +
            '&Product=' + name),
          Error: 'There are multiple products associated with this ' +
            'license key. Please use the URI returned in the Location ' +
            'header.'
        }));
    };
    if (product && options.always300) {
      multipleChoices();
    } else if (product && options.notModified && products.includes(product)) {
      response.statusCode = 304;
      response.end();
    } else if (products.includes(product) ||
      (!product && products.length === 1)) {
      response.statusCode = 200;
      response.end(NEW_DATA);
    } else if (!product) {
      multipleChoices();
    } else {
      response.statusCode = 403;
      response.end(JSON.stringify({
        Error: 'The license key provided does not contain the requested ' +
          'product.'
      }));
    }
  });
  server.listen(0, '127.0.0.1', () => resolve({
    server,
    requests,
    address: 'http://127.0.0.1:' + server.address().port
  }));
});

const stop = (remote) => {
  remote.server.closeAllConnections();
  remote.server.close();
};

describe('license keys that hold several products', () => {
  let folder;
  let file;
  let remotes;
  let logs;
  let service;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'update-product-'));
    file = path.join(folder, 'data.dat');
    fs.writeFileSync(file, 'version 1');
    remotes = [];
    logs = [];
    service = new DataFileUpdateService({
      log: (level, message) => logs.push({ level, message: String(message) })
    });
  });

  afterEach(() => {
    remotes.forEach(stop);
    fs.rmSync(folder, { recursive: true, force: true });
  });

  const serve = async (products, options) => {
    const remote = await distributor(products, options);
    remotes.push(remote);
    return remote;
  };

  // Updates a data file whose loaded data is of the product given and
  // resolves with the status the update ends with. The published date the
  // data file gives is a day later each time it is read, so a request that
  // read it again would carry another If-Modified-Since header.
  const update = (remote, updateProduct, modifiedSince = false,
    updateUrl = remote.address + QUERY) => {
    let reads = 0;
    const dataFile = {
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false,
      attemptedDownload: false,
      updating: false,
      verifyIfModifiedSince: modifiedSince,
      verifyMD5: false,
      decompress: false,
      identifier: 'test',
      flowElement: new TestEngine(),
      refresh: function () {},
      getDatePublished: () => new Date(Date.UTC(2026, 0, 1 + reads++)),
      path: file,
      tempDataDirectory: folder,
      updateUrl
    };
    if (updateProduct !== undefined) {
      // A function is the data file's own way of giving its product.
      dataFile.getUpdateProduct = typeof updateProduct === 'function'
        ? updateProduct
        : () => updateProduct;
    }
    const done = new Promise((resolve) => {
      service.once('updateComplete', (status) => resolve(status));
    });
    service.updateDataFile(dataFile);
    return done;
  };

  const messages = (level) => logs.filter((log) => log.level === level)
    .map((log) => log.message);
  const errors = () => messages('error');

  // A URL as the messages give it, with the license key masked.
  const logged = (remote, query = QUERY) =>
    LicenseKeys.mask(remote.address + query);

  const expectNoKeyLogged = () => {
    expect(logs.map((log) => log.message).join('\n')).not.toContain(KEY);
  };

  test('sends the first request again with the product of the data file',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, 'V4TAC', true);

      expect(errors()).toEqual([]);
      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(fs.readFileSync(file, 'utf8')).toBe(NEW_DATA);
      // The first request is the update URL as it is. The second is the
      // same URL with the product added, and not the URI that was listed,
      // so it keeps Download=True and goes to the configured address.
      expect(remote.requests.map((request) => request.url))
        .toEqual([QUERY, QUERY_WITH_PRODUCT]);
      // Both requests carry the same If-Modified-Since header.
      expect(remote.requests.map((request) => request.modifiedSince))
        .toEqual([
          'Thu, 01 Jan 2026 00:00:00 GMT',
          'Thu, 01 Jan 2026 00:00:00 GMT'
        ]);
      expect(messages('info')).toContain("Requesting product 'V4TAC' from '" +
        logged(remote) + "' for Engine 'TestEngine'");
      expectNoKeyLogged();
    });

  test('does not follow the Location header of the 300', async () => {
    // The 300 names the first URI it lists in a Location header. That URI
    // is for another product, at an address that serves it, so a request
    // that followed the header would arrive there and get the wrong data.
    const other = await serve(['IPIV4Enterprise']);
    const remote = await serve(['IPIV4Enterprise', 'V4TAC'], {
      location: other.address + '/api/v2/download?LicenseKeys=' + KEY +
        '&Type=HashV41&Download=True&Product=IPIV4Enterprise'
    });

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    expect(other.requests).toEqual([]);
    expect(remote.requests.map((request) => request.url))
      .toEqual([QUERY, QUERY_WITH_PRODUCT]);
    expect(fs.readFileSync(file, 'utf8')).toBe(NEW_DATA);
  });

  test('sends no If-Modified-Since header again when the first had none',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, 'V4TAC', false);

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(remote.requests.map((request) => request.modifiedSince))
        .toEqual([undefined, undefined]);
    });

  test('matches the product whatever its case and asks for it as listed',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, 'v4tac');

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(remote.requests.map((request) => request.url))
        .toEqual([QUERY, QUERY_WITH_PRODUCT]);
    });

  test('reports once that there is no newer data for the product',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC'],
        { notModified: true });
      const statuses = [];
      service.on('updateComplete', (status) => statuses.push(status));

      const status = await update(remote, 'V4TAC', true);

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED);
      expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED]);
      expect(errors()).toEqual([]);
      expect(remote.requests).toHaveLength(2);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    });

  test('does not follow a second 300', async () => {
    const remote = await serve(['IPIV4Enterprise', 'V4TAC'],
      { always300: true });

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(remote.requests.map((request) => request.url))
      .toEqual([QUERY, QUERY_WITH_PRODUCT]);
    expect(errors()).toEqual([
      CHECK_ERROR + "HTTP status code '300' from data update service at '" +
        logged(remote, QUERY_WITH_PRODUCT) + "' for engine 'TestEngine'"
    ]);
    expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    expectNoKeyLogged();
  });

  test('names the products when the data file is of none of them',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, 'V4Enterprise');

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
      expect(errors()).toEqual([
        CHECK_ERROR + "Product 'V4Enterprise' is not offered by data " +
          "update service at '" + logged(remote) + "' for engine 'TestEngine'. Products offered: " +
          "'IPIV4Enterprise,V4TAC'"
      ]);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
      expect(remote.requests).toHaveLength(1);
      expectNoKeyLogged();
    });

  test.each([
    ['gives an empty product', ''],
    ['names no product', undefined]
  ])('names the products when the data file %s', async (name, product) => {
    const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

    const status = await update(remote, product);

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(errors()).toEqual([
      CHECK_ERROR + "Product '' is not offered by data update service at '" +
        logged(remote) + "' for engine 'TestEngine'. Products offered: " +
        "'IPIV4Enterprise,V4TAC'"
    ]);
    expect(remote.requests).toHaveLength(1);
    expectNoKeyLogged();
  });

  test('ignores a URI that names no product', async () => {
    const remote = await serve(['V4TAC', 'V4Enterprise'], {
      uris: [
        'http://127.0.0.1:9/api/v2/download?Type=HashV41',
        'http://127.0.0.1:9/api/v2/download?Type=HashV41&Product=V4TAC',
        7
      ]
    });

    const status = await update(remote, 'V4Enterprise');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toMatch(/Products offered: 'V4TAC'$/);
    expect(remote.requests).toHaveLength(1);
  });

  test.each([
    ['is not JSON', 'Multiple choices'],
    ['has no list', JSON.stringify({ Error: 'Multiple choices' })]
  ])('gives the status code when the 300 response %s', async (name, body) => {
    const remote = await serve(['IPIV4Enterprise', 'V4TAC'], { body });

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(errors()).toEqual([
      CHECK_ERROR + "HTTP status code '300' from data update service at '" +
        logged(remote) + "' for engine 'TestEngine'"
    ]);
    expect(remote.requests).toHaveLength(1);
    expectNoKeyLogged();
  });

  // A list that gives no product is no list to choose from, so the 300 is
  // any other response and not a product that is not offered.
  test.each([
    ['lists no product',
      ['http://127.0.0.1:9/api/v2/download?Type=HashV41', 7]],
    ['lists nothing', []]
  ])('gives the status code when the 300 response %s', async (name, uris) => {
    const remote = await serve(['IPIV4Enterprise', 'V4TAC'], { uris });

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(errors()).toEqual([
      CHECK_ERROR + "HTTP status code '300' from data update service at '" +
        logged(remote) + "' for engine 'TestEngine'"
    ]);
    expect(remote.requests).toHaveLength(1);
    expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    expectNoKeyLogged();
  });

  test('logs the second request as a request, with the URL it is sent to',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, 'V4TAC');

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      // The first request and the choice of the product name the URL of the
      // first request. The second request names its own URL, which has the
      // product added.
      expect(messages('info').filter((message) =>
        /^(Checking for update from|Requesting product) /.test(message)))
        .toEqual([
          "Checking for update from '" + logged(remote) +
            "' for Engine 'TestEngine'",
          "Requesting product 'V4TAC' from '" + logged(remote) +
            "' for Engine 'TestEngine'",
          "Checking for update from '" +
            logged(remote, QUERY_WITH_PRODUCT) + "' for Engine 'TestEngine'"
        ]);
      expectNoKeyLogged();
    });

  test('reports an error the data file raises when asked for its product',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, () => {
        throw new Error('no product');
      });

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR);
      expect(errors()).toHaveLength(1);
      expect(errors()[0]).toContain('An unhandled error occurred while ' +
        "checking for automatic updates for engine 'TestEngine'");
      expect(remote.requests).toHaveLength(1);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
      expectNoKeyLogged();
    });

  test('does not read a list of more than 65,536 bytes', async () => {
    // The list offers the product, and is longer than is read, so what is
    // read of it is not JSON.
    const remote = await serve(['IPIV4Enterprise', 'V4TAC'], {
      body: JSON.stringify({
        AvailableUris: [
          'http://127.0.0.1:9/api/v2/download?Type=HashV41&Product=V4TAC'
        ],
        Padding: 'x'.repeat(70000)
      })
    });

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(errors()).toEqual([
      CHECK_ERROR + "HTTP status code '300' from data update service at '" +
        logged(remote) + "' for engine 'TestEngine'"
    ]);
    expect(remote.requests).toHaveLength(1);
    expectNoKeyLogged();
  });

  test('reports a 300 response that closes before it ends', async () => {
    const remote = await serve(['IPIV4Enterprise', 'V4TAC'],
      { cutShort: true });
    const statuses = [];
    service.on('updateComplete', (status) => statuses.push(status));

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
    expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR]);
    expect(errors()).toHaveLength(1);
    expect(errors()[0]).toContain(
      "Error accessing data update service at '" + logged(remote) +
      "' for engine 'TestEngine'");
    expect(remote.requests).toHaveLength(1);
    expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    expectNoKeyLogged();
  });

  test('license keys that hold one product are asked once', async () => {
    const remote = await serve(['V4TAC']);

    const status = await update(remote, 'V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    expect(fs.readFileSync(file, 'utf8')).toBe(NEW_DATA);
    expect(remote.requests.map((request) => request.url)).toEqual([QUERY]);
  });

  // The update URL a data file of the kind given asks, as its URL formatter
  // makes it, with the product configured where one is given.
  const formatted = (DataFile, remote, product, Type = 'HashV41') =>
    new DataFile({
      updateURLParams: {
        baseURL: remote.address + '/api/v2/download',
        Type,
        licenseKeys: KEY,
        product
      }
    }).updateUrl;

  const productsAsked = (remote) => remote.requests.map((request) =>
    new URL(request.url, remote.address).searchParams.getAll('Product'));

  test.each([
    ['Device Detection', DeviceDetectionDataFile, 'V4TAC', 'HashV41'],
    ['IP Intelligence', IpIntelligenceDataFile, 'IPIV4Enterprise', 'IPIV41']
  ])('the first %s request carries the configured product',
    async (name, DataFile, product, type) => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, undefined, true,
        formatted(DataFile, remote, product, type));

      expect(errors()).toEqual([]);
      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(fs.readFileSync(file, 'utf8')).toBe(NEW_DATA);
      // One request, which names the product, so no product is chosen.
      expect(productsAsked(remote)).toEqual([[product]]);
      expect(messages('info').join('\n')).not.toContain('Requesting product');
      expectNoKeyLogged();
    });

  test.each([
    ['Device Detection', DeviceDetectionDataFile, 'HashV41'],
    ['IP Intelligence', IpIntelligenceDataFile, 'IPIV41']
  ])('the first %s request has no Product parameter with none configured',
    async (name, DataFile, type) => {
      const remote = await serve(['V4TAC']);

      const status = await update(remote, 'V4TAC', false,
        formatted(DataFile, remote, undefined, type));

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(remote.requests).toHaveLength(1);
      // Not even an empty one.
      expect(remote.requests[0].url).not.toMatch(/product/i);
    });

  test('with none configured the product is added only after a 300',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);

      const status = await update(remote, 'V4TAC', false,
        formatted(DeviceDetectionDataFile, remote, undefined));

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(remote.requests[0].url).not.toMatch(/product/i);
      expect(productsAsked(remote)).toEqual([[], ['V4TAC']]);
    });

  test('a 300 to a request with the configured product is not followed',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC'],
        { always300: true });
      const updateUrl = formatted(DeviceDetectionDataFile, remote, 'V4TAC');

      // The loaded data file is of a product that is listed, and it is
      // still not chosen.
      const status = await update(remote, 'V4TAC', false, updateUrl);

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
      expect(productsAsked(remote)).toEqual([['V4TAC']]);
      expect(errors()).toEqual([
        CHECK_ERROR + "HTTP status code '300' from data update service at '" +
          LicenseKeys.mask(updateUrl) + "' for engine 'TestEngine'"
      ]);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
      expectNoKeyLogged();
    });

  test('a configured product the license keys do not hold is denied',
    async () => {
      const remote = await serve(['IPIV4Enterprise', 'V4TAC']);
      const updateUrl =
        formatted(DeviceDetectionDataFile, remote, 'V4Enterprise');

      const status = await update(remote, 'V4TAC', false, updateUrl);

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_ERR_403_FORBIDDEN);
      expect(productsAsked(remote)).toEqual([['V4Enterprise']]);
      expect(errors()).toEqual([
        CHECK_ERROR + "Access denied to data update service at '" +
          LicenseKeys.mask(updateUrl) + "' for engine 'TestEngine'"
      ]);
      expectNoKeyLogged();
    });
});

// A data file names a product in its update URL only when one is
// configured, and then whether or not the default parameters are added.
describe('the update URL of a data file', () => {
  const updateUrl = (DataFile, product, useUrlFormatter, baseURL) =>
    new DataFile({
      useUrlFormatter,
      updateURLParams: {
        baseURL: baseURL || 'https://example.com/download',
        Type: 'T',
        licenseKeys: KEY,
        product
      }
    }).updateUrl;

  test.each([
    ['Device Detection', DeviceDetectionDataFile],
    ['IP Intelligence', IpIntelligenceDataFile]
  ])('names no product for %s with none configured', (name, DataFile) => {
    expect(updateUrl(DataFile, undefined, true)).toBe(
      'https://example.com/download?Type=T&licenseKeys=' + KEY);
    expect(updateUrl(DataFile, '', true)).not.toMatch(/product/i);
    expect(updateUrl(DataFile, undefined, false))
      .toBe('https://example.com/download');
  });

  test.each([
    ['Device Detection', DeviceDetectionDataFile],
    ['IP Intelligence', IpIntelligenceDataFile]
  ])('names the configured product once for %s', (name, DataFile) => {
    const parsed = new URL(updateUrl(DataFile, 'V4TAC', true));
    expect(parsed.searchParams.getAll('Product')).toEqual(['V4TAC']);
    expect(parsed.searchParams.get('Type')).toBe('T');
    expect(parsed.searchParams.get('licenseKeys')).toBe(KEY);
    // Without the default parameters the product is still named.
    expect(updateUrl(DataFile, 'V4TAC', false))
      .toBe('https://example.com/download?Product=V4TAC');
    expect(updateUrl(DataFile, 'V4TAC', false,
      'https://example.com/download?a=b'))
      .toBe('https://example.com/download?a=b&Product=V4TAC');
  });
});

// The product name of a data file is a prefix for the kind of data file,
// 'V4' for Device Detection and 'IPIV4' for IP Intelligence, and then the
// tier of the data file the engine has loaded.
describe('the product name of the loaded data file', () => {
  const product = (DataFile, engine) => new DataFile({
    flowElement: { engine },
    updateURLParams: {}
  }).getUpdateProduct();

  test.each([
    ['TAC', 'V4TAC'],
    ['Enterprise', 'V4Enterprise'],
    ['v4TAC', 'v4TAC']
  ])('is V4 and the tier for the Device Detection %s data file',
    (tier, name) => {
      expect(product(DeviceDetectionDataFile, { getProduct: () => tier }))
        .toBe(name);
    });

  test.each([
    ['Enterprise', 'IPIV4Enterprise'],
    ['IPIV4Enterprise', 'IPIV4Enterprise'],
    ['ipiv4Lite', 'ipiv4Lite']
  ])('is IPIV4 and the tier for the IP Intelligence %s data file',
    (tier, name) => {
      expect(product(IpIntelligenceDataFile, { getProduct: () => tier }))
        .toBe(name);
    });

  test.each([
    ['Device Detection', DeviceDetectionDataFile],
    ['IP Intelligence', IpIntelligenceDataFile]
  ])('is empty for %s before a data file is loaded', (name, DataFile) => {
    expect(product(DataFile, undefined)).toBe('');
  });
});
