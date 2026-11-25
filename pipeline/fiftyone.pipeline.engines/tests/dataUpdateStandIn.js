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

// A stand-in for the Distributor on this machine, so that a test of a data
// file update example never reaches the Distributor. It answers as the
// Distributor does for license keys that hold several products, whatever
// key it is sent:
//  - a request that names no product gets 300 with the list of products
//    and a Location header naming the first
//  - a request for a product not on the list gets 403
//  - a request for a product on the list gets the data file to serve,
//    gzipped and with the MD5 hash of what is sent, unless there is no file
//    to serve or the request's If-Modified-Since is not earlier than the
//    file's published date, when it gets 304
// Every request is kept, with the product it named and the status it got,
// so a test can check what the example asked for. It is built from the
// stand-in in dataUpdateProduct.test.js.

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const { pipeline } = require('stream/promises');
const zlib = require('zlib');

// Where the published date starts in the header of a Hash or an IP
// Intelligence data file. The date is a 16 bit year, little endian, then a
// byte each for the month and the day.
const PUBLISHED_OFFSET = 66;

const NOT_OFFERED = JSON.stringify({
  Error: 'The license key provided does not contain the requested product.'
});

const SEVERAL_PRODUCTS = 'There are multiple products associated with ' +
  'this license key. Please use the URI returned in the Location header.';

/**
 * The published date in a data file's header.
 *
 * @param {string} file the data file
 * @returns {Date} the date, at midnight UTC
 */
const readPublished = function (file) {
  const header = Buffer.alloc(4);
  const fd = fs.openSync(file, 'r');
  try {
    fs.readSync(fd, header, 0, header.length, PUBLISHED_OFFSET);
  } finally {
    fs.closeSync(fd);
  }
  return new Date(Date.UTC(
    header.readInt16LE(0), header.readUInt8(2) - 1, header.readUInt8(3)));
};

/**
 * Sets the published date in a data file's header, so that a copy of a
 * data file can stand for a newer one.
 *
 * @param {string} file the data file
 * @param {Date} date the date, of which the UTC day is written
 */
const writePublished = function (file, date) {
  const header = Buffer.alloc(4);
  header.writeInt16LE(date.getUTCFullYear(), 0);
  header.writeUInt8(date.getUTCMonth() + 1, 2);
  header.writeUInt8(date.getUTCDate(), 3);
  const fd = fs.openSync(file, 'r+');
  try {
    fs.writeSync(fd, header, 0, header.length, PUBLISHED_OFFSET);
  } finally {
    fs.closeSync(fd);
  }
};

/**
 * The value of the Product parameter of a URL, its name matched ignoring
 * case, or null when there is none or it is empty.
 *
 * @param {URL} url the URL requested
 * @returns {string|null} the product
 */
const productOf = function (url) {
  for (const [name, value] of url.searchParams) {
    if (name.toLowerCase() === 'product') {
      return value === '' ? null : value;
    }
  }
  return null;
};

/**
 * The URL requested with Product set to the product, as each URI the
 * Distributor lists is.
 *
 * @param {URL} url the URL requested
 * @param {string} product the product
 * @returns {string} the URL for the product
 */
const withProduct = function (url, product) {
  const listed = new URL(url.href);
  for (const name of Array.from(listed.searchParams.keys())) {
    if (name.toLowerCase() === 'product') {
      listed.searchParams.delete(name);
    }
  }
  listed.searchParams.append('Product', product);
  return listed.href;
};

class DataUpdateStandIn {
  /**
   * Use start, which also gets the stand-in ready to answer.
   *
   * @param {Array<string>} products the products the license key holds, in
   * the order the Distributor lists them
   * @param {string|null} dataFile the data file to serve, or null to answer
   * every request for a product on the list with 304
   */
  constructor (products, dataFile) {
    this.products = products.slice();
    this.dataFile = dataFile;
    this.requests = [];
  }

  /**
   * Starts a stand-in on a free port of this machine.
   *
   * @param {Array<string>} products the products the license key holds
   * @param {string|null} dataFile the data file to serve, or null
   * @returns {Promise<DataUpdateStandIn>} the stand-in, answering
   */
  static async start (products, dataFile) {
    const standIn = new DataUpdateStandIn(products, dataFile);
    if (dataFile) {
      standIn.published = readPublished(dataFile);
      standIn.compressed = dataFile + '.gz';
      await pipeline(
        fs.createReadStream(dataFile),
        zlib.createGzip({ level: zlib.constants.Z_BEST_SPEED }),
        fs.createWriteStream(standIn.compressed));
      // The Distributor sends the MD5 hash of the compressed file as lower
      // case hexadecimal, which the data update service checks.
      const hash = crypto.createHash('md5');
      await pipeline(fs.createReadStream(standIn.compressed), hash);
      standIn.md5 = hash.digest('hex');
    }
    standIn.server = http.createServer(
      (request, response) => standIn.answer(request, response));
    await new Promise((resolve) =>
      standIn.server.listen(0, '127.0.0.1', resolve));
    standIn.url = 'http://127.0.0.1:' + standIn.server.address().port +
      '/api/v2/download';
    return standIn;
  }

  answer (request, response) {
    const url = new URL(request.url, this.url);
    const product = productOf(url);
    const record = (status) => this.requests.push({ product, status });
    if (product === null) {
      const uris = this.products.map((name) => withProduct(url, name));
      record(300);
      response.writeHead(300, {
        'Content-Type': 'application/json',
        Location: uris[0]
      });
      response.end(JSON.stringify({
        AvailableUris: uris,
        Error: SEVERAL_PRODUCTS
      }));
    } else if (!this.products.some(
      (name) => name.toLowerCase() === product.toLowerCase())) {
      record(403);
      response.writeHead(403, { 'Content-Type': 'application/json' });
      response.end(NOT_OFFERED);
    } else if (!this.compressed || this.isNotModified(request)) {
      record(304);
      response.writeHead(304);
      response.end();
    } else {
      record(200);
      response.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-MD5': this.md5,
        'Content-Length': fs.statSync(this.compressed).size
      });
      // An example that ends before the file is sent ends only this answer.
      pipeline(fs.createReadStream(this.compressed), response)
        .catch(() => {});
    }
  }

  /**
   * True when the request's If-Modified-Since is not earlier than the
   * published date of the file served, so the file is not newer.
   *
   * @param {http.IncomingMessage} request the request
   * @returns {boolean} true when the file served is not newer
   */
  isNotModified (request) {
    const since = Date.parse(request.headers['if-modified-since']);
    return !Number.isNaN(since) && since >= this.published.getTime();
  }

  /**
   * Stops answering and removes the compressed file.
   *
   * @returns {Promise<void>} settles once the stand-in has stopped
   */
  async stop () {
    this.server.closeAllConnections();
    await new Promise((resolve) => this.server.close(() => resolve()));
    if (this.compressed) {
      fs.rmSync(this.compressed, { force: true });
    }
  }
}

DataUpdateStandIn.readPublished = readPublished;
DataUpdateStandIn.writePublished = writePublished;

module.exports = DataUpdateStandIn;
