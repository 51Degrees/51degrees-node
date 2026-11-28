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

// The stand-in for the Distributor that the tests of the data file update
// examples use answers the data update service as the Distributor does.
// These tests run the service against it with a small file in place of a
// data file, so they need no data file and no license key.

const fs = require('fs');
const os = require('os');
const path = require('path');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));
const DataUpdateStandIn = require(path.join(__dirname, 'dataUpdateStandIn'));

const KEY = 'ABCDEFGH1234';
const PUBLISHED = new Date(Date.UTC(2026, 10, 2));
const NEWER = new Date(Date.UTC(2026, 10, 3));

class TestEngine {
  constructor () {
    this.dataKey = 'testEngine';
  }
}

// A file with a data file's header, long enough to hold the published
// date, and the date given in it.
const writeDataFile = (file, date, fill) => {
  fs.writeFileSync(file, Buffer.alloc(200, fill));
  DataUpdateStandIn.writePublished(file, date);
};

describe('the stand-in for the Distributor', () => {
  let folder;
  let file;
  let served;
  let standIn;
  let service;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'update-stand-in-'));
    file = path.join(folder, 'data.hash');
    writeDataFile(file, PUBLISHED, 1);
    served = path.join(folder, 'served.hash');
    writeDataFile(served, NEWER, 2);
    // What the service logs is not written out.
    service = new DataFileUpdateService({ log: () => {} });
  });

  afterEach(async () => {
    if (standIn) {
      await standIn.stop();
      standIn = undefined;
    }
    fs.rmSync(folder, { recursive: true, force: true });
  });

  // Updates the file from the stand-in, as a data file of the product
  // given and published on the date given, and resolves with the status.
  const update = (product, published, query = '') => {
    const dataFile = {
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false,
      attemptedDownload: false,
      updating: false,
      verifyIfModifiedSince: true,
      verifyMD5: true,
      decompress: true,
      identifier: 'test',
      flowElement: new TestEngine(),
      refresh: function () {},
      getDatePublished: () => published,
      getUpdateProduct: () => product,
      path: file,
      tempDataDirectory: folder,
      updateUrl: standIn.url + '?Type=HashV41&Download=True&licenseKeys=' +
        KEY + query
    };
    const done = new Promise((resolve) => {
      service.once('updateComplete', (status) => resolve(status));
    });
    service.updateDataFile(dataFile);
    return done;
  };

  test('reads the published date it writes', () => {
    expect(DataUpdateStandIn.readPublished(file)).toEqual(PUBLISHED);
    expect(DataUpdateStandIn.readPublished(served)).toEqual(NEWER);
  });

  test('lists the products, then serves the file for the one asked for',
    async () => {
      standIn = await DataUpdateStandIn.start(
        ['IPIV4Enterprise', 'V4TAC'], served);

      const status = await update('V4TAC', PUBLISHED);

      expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(standIn.requests).toEqual([
        { product: null, status: 300 },
        { product: 'V4TAC', status: 200 }
      ]);
      expect(fs.readFileSync(file)).toEqual(fs.readFileSync(served));
    });

  test('answers 304 when the file served is not newer', async () => {
    standIn = await DataUpdateStandIn.start(['V4TAC'], served);

    const status = await update('V4TAC', NEWER, '&Product=V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED);
    expect(standIn.requests).toEqual([{ product: 'V4TAC', status: 304 }]);
    expect(DataUpdateStandIn.readPublished(file)).toEqual(PUBLISHED);
  });

  test('answers 304 when it has no file to serve', async () => {
    standIn = await DataUpdateStandIn.start(['IPIV4Enterprise'], null);

    const status = await update('IPIV4Enterprise', PUBLISHED,
      '&Product=IPIV4Enterprise');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED);
    expect(standIn.requests)
      .toEqual([{ product: 'IPIV4Enterprise', status: 304 }]);
  });

  test('answers 403 for a product it does not list', async () => {
    standIn = await DataUpdateStandIn.start(['IPIV4Enterprise'], served);

    const status = await update('V4TAC', PUBLISHED, '&Product=V4TAC');

    expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_ERR_403_FORBIDDEN);
    expect(standIn.requests).toEqual([{ product: 'V4TAC', status: 403 }]);
  });

  test('lists every product with no product named', async () => {
    standIn = await DataUpdateStandIn.start(
      ['IPIV4Enterprise', 'V4TAC'], served);

    const status = await update('', PUBLISHED);

    // With no product known, none is chosen from the list.
    expect(status).not.toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    expect(standIn.requests).toEqual([{ product: null, status: 300 }]);
  });
});
