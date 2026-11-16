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

// The messages and statuses of the data update service MUST be the same in
// every language (pipeline-specification/features/data-updates.md lines 481
// to 483 at specifications commit 07e1fce). "An error of any other kind is
// logged at Error with the message in the last row, also with the error
// attached" (lines 487 and 488), and that row's status is
// AUTO_UPDATE_UNKNOWN_ERROR (line 515). A 304 is logged naming a datetime,
// "No data newer than <datetime> found at '<url>' for Engine '<Engine type>'"
// (line 469), whether or not the request carried If-Modified-Since.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const { Writable } = require('stream');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));

class TestEngine {
  constructor () {
    this.dataKey = 'testEngine';
  }
}

// The last row's message for the engine above, with the cause given.
const unhandled = (cause) =>
  'An unhandled error occurred while checking for automatic updates for ' +
  "engine 'TestEngine'. Error detail: " + cause;

const newFolder = () =>
  fs.mkdtempSync(path.join(os.tmpdir(), 'update-rows-'));

// An update service whose log calls are kept as { level, message }.
const loggingService = () => {
  const logs = [];
  const service = new DataFileUpdateService({
    log: (level, message) => logs.push({ level, message })
  });
  return { service, logs };
};

// Stands in for a data file, with the options the update route reads.
const standInDataFile = (overrides) => Object.assign({
  autoUpdate: false,
  updateOnStart: false,
  fileSystemWatcher: false,
  attemptedDownload: false,
  updating: false,
  verifyIfModifiedSince: true,
  verifyMD5: false,
  decompress: false,
  identifier: 'test',
  flowElement: new TestEngine(),
  refresh: function () {}
}, overrides);

// Answers each request with the status and body given.
const serve = (status, body) => new Promise((resolve) => {
  const server = http.createServer((request, response) => {
    response.statusCode = status;
    response.end(body);
  });
  server.listen(0, '127.0.0.1', () => resolve({
    server,
    url: 'http://127.0.0.1:' + server.address().port + '/datafile'
  }));
});

const stop = (server) => {
  server.closeAllConnections();
  server.close();
};

// Resolves at the next updateComplete event with its status.
const completed = (service) => new Promise((resolve) => {
  service.once('updateComplete', (status) => resolve(status));
});

const errorsIn = (logs) => logs
  .filter((log) => log.level === 'error')
  .map((log) => String(log.message));

describe('an error with no row of its own in the download', () => {
  let folder;
  let file;
  let remote;
  let spies;

  beforeEach(() => {
    folder = newFolder();
    file = path.join(folder, 'data.dat');
    fs.writeFileSync(file, 'version 1');
    spies = [];
  });

  afterEach(() => {
    spies.forEach((spy) => spy.mockRestore());
    if (remote) {
      stop(remote.server);
      remote = undefined;
    }
  });

  // Fails each fs.readFile of a file in the folder, other than the data
  // file itself.
  const failReadsOfDownloads = () => {
    const readFile = fs.readFile;
    spies.push(jest.spyOn(fs, 'readFile').mockImplementation(
      (name, ...rest) => {
        if (String(name).startsWith(folder) && name !== file) {
          rest[rest.length - 1](Object.assign(new Error('cannot read'),
            { code: 'EACCES' }));
        } else {
          readFile(name, ...rest);
        }
      }));
  };

  const update = async (overrides) => {
    const { service, logs } = loggingService();
    const dataFile = standInDataFile(Object.assign({
      updateUrl: remote.url,
      tempDataDirectory: folder,
      path: file
    }, overrides));
    const statuses = [];
    service.on('updateComplete', (status) => statuses.push(status));
    const done = completed(service);
    service.updateDataFile(dataFile);
    await done;
    // Long enough for a second report, if there were one, to arrive.
    await new Promise((resolve) => setTimeout(resolve, 300));
    return { statuses, errors: errorsIn(logs), dataFile };
  };

  test('a download that cannot be read is the unknown error', async () => {
    remote = await serve(200, 'version 2');
    failReadsOfDownloads();
    const { statuses, errors, dataFile } = await update({});
    expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR]);
    expect(errors).toEqual([unhandled('cannot read')]);
    expect(dataFile.updating).toBe(false);
    expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
  });

  test('a compressed download that cannot be read is the unknown error',
    async () => {
      remote = await serve(200, zlib.gzipSync('version 2'));
      failReadsOfDownloads();
      const { statuses, errors } = await update({ decompress: true });
      expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR]);
      expect(errors).toEqual([unhandled('cannot read')]);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    });

  test('a download that cannot be written is the unknown error',
    async () => {
      remote = await serve(200, 'version 2');
      const createWriteStream = fs.createWriteStream;
      spies.push(jest.spyOn(fs, 'createWriteStream').mockImplementation(
        (name, ...rest) => {
          if (String(name).startsWith(folder)) {
            return new Writable({
              write (chunk, encoding, callback) {
                callback(Object.assign(new Error('cannot write'),
                  { code: 'ENOSPC' }));
              }
            });
          }
          return createWriteStream(name, ...rest);
        }));
      const { statuses, errors } = await update({});
      expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR]);
      expect(errors).toEqual([unhandled('cannot write')]);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    });

  test('a decompressed download that cannot be written is the unknown ' +
    'error', async () => {
    remote = await serve(200, zlib.gzipSync('version 2'));
    const writeFile = fs.writeFile;
    spies.push(jest.spyOn(fs, 'writeFile').mockImplementation(
      (name, data, callback) => {
        if (String(name).endsWith('_done')) {
          callback(Object.assign(new Error('cannot write'),
            { code: 'ENOSPC' }));
        } else {
          writeFile(name, data, callback);
        }
      }));
    const { statuses, errors } = await update({ decompress: true });
    expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_UNKNOWN_ERROR]);
    expect(errors).toEqual([unhandled('cannot write')]);
    expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
  });
});

describe('a 304 response', () => {
  test('names the date of the data when no If-Modified-Since was sent',
    async () => {
      const folder = newFolder();
      const file = path.join(folder, 'data.dat');
      fs.writeFileSync(file, 'version 1');
      const remote = await serve(304, '');
      try {
        const { service, logs } = loggingService();
        const dataFile = standInDataFile({
          updateUrl: remote.url,
          tempDataDirectory: folder,
          path: file,
          verifyIfModifiedSince: false,
          getDatePublished: () => new Date(Date.UTC(2026, 5, 1, 12, 0, 0))
        });
        const done = completed(service);
        service.updateDataFile(dataFile);
        expect(await done).toBe(AutoUpdateStatus.AUTO_UPDATE_NOT_NEEDED);
        expect(logs.map((log) => log.level + ': ' + log.message)).toContain(
          'info: No data newer than Mon, 01 Jun 2026 12:00:00 GMT found at \'' +
          remote.url + "' for Engine 'TestEngine'");
      } finally {
        stop(remote.server);
      }
    });
});
