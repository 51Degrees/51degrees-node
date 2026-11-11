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

// Checks the data update service against the Data update page of the
// pipeline specification, which sets the If-Modified-Since fallback, when
// the first check is made, programmatic update of a memory data file and
// the log messages.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const { Readable } = require('stream');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const MinuteMilliseconds = 60000;
const HourMilliseconds = 60 * MinuteMilliseconds;
const DayMilliseconds = 24 * HourMilliseconds;
const MaximumTimerMilliseconds = 2147483647;

class TestEngine {
  constructor () {
    this.dataKey = 'testEngine';
  }
}

const newFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'update-spec-'));

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

// Answers each request with the status and body given and keeps the headers
// of the requests.
const serve = (status, body) => new Promise((resolve) => {
  const requests = [];
  const server = http.createServer((request, response) => {
    requests.push(request.headers);
    response.statusCode = status;
    response.write(body);
    setTimeout(() => response.end(), 50);
  });
  server.listen(0, '127.0.0.1', () => resolve({
    server,
    requests,
    url: 'http://127.0.0.1:' + server.address().port + '/datafile'
  }));
});

const stop = (server) => {
  server.closeAllConnections();
  server.close();
};

// Resolves at the next updateComplete event.
const completed = (service) => new Promise((resolve) => {
  service.once('updateComplete', (status) => resolve(status));
});

describe('If-Modified-Since', () => {
  let folder;
  let file;
  let remote;
  const modified = new Date(Date.UTC(2026, 0, 15, 8, 30, 0));

  beforeEach(async () => {
    folder = newFolder();
    file = path.join(folder, 'data.dat');
    fs.writeFileSync(file, 'version 1');
    fs.utimesSync(file, modified, modified);
    remote = await serve(304, '');
  });

  afterEach(() => {
    stop(remote.server);
  });

  const check = async (dataFile) => {
    const { service } = loggingService();
    Object.assign(dataFile, {
      updateUrl: remote.url,
      tempDataDirectory: folder
    });
    const done = completed(service);
    service.updateDataFile(dataFile);
    await done;
    return remote.requests[0]['if-modified-since'];
  };

  test('is the published date when the data file has one', async () => {
    const published = new Date(Date.UTC(2026, 5, 1, 12, 0, 0));
    const header = await check(standInDataFile({
      path: file,
      getDatePublished: () => published
    }));
    expect(header).toBe('Mon, 01 Jun 2026 12:00:00 GMT');
  });

  test('is the file last modified time when there is no published date',
    async () => {
      const header = await check(standInDataFile({
        path: file,
        getDatePublished: () => {
          throw new Error('The data file has no published date.');
        }
      }));
      expect(header).toBe('Thu, 15 Jan 2026 08:30:00 GMT');
    });

  test('is the file last modified time when the published date is not a ' +
    'date', async () => {
    const header = await check(standInDataFile({
      path: file,
      getDatePublished: () => new Date(NaN)
    }));
    expect(header).toBe('Thu, 15 Jan 2026 08:30:00 GMT');
  });

  test('is the file last modified time when there is no way to get a ' +
    'published date', async () => {
    const header = await check(standInDataFile({ path: file }));
    expect(header).toBe('Thu, 15 Jan 2026 08:30:00 GMT');
  });

  test('is not sent when there is no published date and no file',
    async () => {
      const header = await check(standInDataFile({
        path: path.join(folder, 'missing.dat'),
        getDatePublished: () => {
          throw new Error('The data file has no published date.');
        }
      }));
      expect(header).toBeUndefined();
    });
});

describe('first check after an update', () => {
  let setTimeoutSpy;
  let randomSpy;
  const delays = [];

  beforeEach(() => {
    delays.length = 0;
    setTimeoutSpy = jest.spyOn(global, 'setTimeout').mockImplementation(
      (callback, delay) => {
        delays.push(delay);
        return { unref: () => {} };
      });
    // Gives a random offset of six minutes.
    randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
  });

  afterEach(() => {
    setTimeoutSpy.mockRestore();
    randomSpy.mockRestore();
  });

  const schedule = (nextUpdate) => {
    const { service } = loggingService();
    service.checkNextUpdate(standInDataFile({
      autoUpdate: true,
      pollingInterval: 30,
      updateTimeMaximumRandomisation: 10,
      getNextUpdate: () => nextUpdate
    }));
    return delays[0];
  };

  test('waits for the polling interval and the offset when no update is ' +
    'expected in the future', () => {
    const delay = schedule(new Date(Date.now() - HourMilliseconds));
    expect(delay).toBe(36 * MinuteMilliseconds);
  });

  test('waits until the update is expected, then the offset', () => {
    const before = Date.now();
    const delay = schedule(new Date(before + 2 * HourMilliseconds));
    const after = Date.now();
    const expected = 2 * HourMilliseconds + 6 * MinuteMilliseconds;
    expect(delay).toBeGreaterThanOrEqual(expected - (after - before));
    expect(delay).toBeLessThanOrEqual(expected);
  });

  test('waits no longer than a timer can', () => {
    const delay = schedule(new Date(Date.now() + 90 * DayMilliseconds));
    expect(delay).toBe(MaximumTimerMilliseconds);
  });
});

describe('update from memory', () => {
  const memoryDataFile = (content) => {
    const dataFile = standInDataFile({
      data: Buffer.from(content),
      seen: null
    });
    dataFile.refresh = function () {
      if (this.data.toString().startsWith('unusable')) {
        throw new Error('The data cannot be used.');
      }
      this.seen = this.data.toString();
    };
    return dataFile;
  };

  test('refreshes the data file with the bytes given', async () => {
    const { service } = loggingService();
    const dataFile = memoryDataFile('version 1');
    const done = completed(service);
    expect(service.updateFromMemory(dataFile, Buffer.from('version 2')))
      .toBe(true);
    expect(await done).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    expect(dataFile.data.toString()).toBe('version 2');
    expect(dataFile.seen).toBe('version 2');
    expect(dataFile.updating).toBe(false);
  });

  // The status is reported from timer, request and file system watcher
  // callbacks, where an error thrown by an application's listener would be
  // uncaught and end the process.
  test('a listener that throws is logged and the others still hear',
    () => {
      const { service, logs } = loggingService();
      const dataFile = memoryDataFile('version 1');
      const heard = [];
      service.on('updateComplete', () => {
        throw new Error('The listener failed.');
      });
      service.once('updateComplete', (status) => heard.push(status));
      expect(service.updateFromMemory(dataFile, Buffer.from('version 2')))
        .toBe(true);
      expect(heard).toEqual([AutoUpdateStatus.AUTO_UPDATE_SUCCESS]);
      expect(logs.filter((log) => log.level === 'error')
        .map((log) => String(log.message))).toEqual([
        'An update complete callback raised an error for TestEngine. ' +
        'Error detail: The listener failed.'
      ]);
      service.updateFromMemory(dataFile, Buffer.from('version 3'));
      expect(heard).toHaveLength(1);
    });

  // The data file's own onUpdateComplete is the other update complete
  // callback, so an error it throws is reported in the same words.
  test('an error from the data file callback is logged in the same words',
    () => {
      const { service, logs } = loggingService();
      const dataFile = memoryDataFile('version 1');
      dataFile.onUpdateComplete = () => {
        throw new Error('The data file callback failed.');
      };
      expect(service.updateFromMemory(dataFile, Buffer.from('version 2')))
        .toBe(true);
      expect(logs.filter((log) => log.level === 'error')
        .map((log) => String(log.message))).toEqual([
        'An update complete callback raised an error for TestEngine. ' +
        'Error detail: The data file callback failed.'
      ]);
    });

  test('keeps the data it has when the refresh fails', async () => {
    const { service, logs } = loggingService();
    const dataFile = memoryDataFile('version 1');
    const done = completed(service);
    expect(service.updateFromMemory(dataFile, Buffer.from('unusable')))
      .toBe(false);
    expect(await done).toBe(AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
    expect(dataFile.data.toString()).toBe('version 1');
    expect(dataFile.updating).toBe(false);
    expect(logs.some((log) => log.level === 'error')).toBe(true);
  });

  test('does not run while the data file is updating', () => {
    const { service } = loggingService();
    const dataFile = memoryDataFile('version 1');
    dataFile.updating = true;
    expect(service.updateFromMemory(dataFile, Buffer.from('version 2')))
      .toBe(false);
    expect(dataFile.data.toString()).toBe('version 1');
  });

  test('refuses something that is not bytes', () => {
    const { service } = loggingService();
    expect(() => service.updateFromMemory(memoryDataFile('version 1'),
      'version 2')).toThrow('must be a Buffer or a Uint8Array');
  });

  test('refuses a data file that is read from a path', () => {
    const { service } = loggingService();
    const dataFile = memoryDataFile('version 1');
    dataFile.path = '/some/file.dat';
    expect(() => service.updateFromMemory(dataFile, Buffer.from('x')))
      .toThrow('not held in memory');
  });
});

describe('log messages', () => {
  let folder;
  let file;

  beforeEach(() => {
    folder = newFolder();
    file = path.join(folder, 'data.dat');
    fs.writeFileSync(file, 'version 1');
  });

  const messages = (logs) => logs.map((log) => log.level + ': ' + log.message);

  test('an update on start-up is logged', () => {
    const { service, logs } = loggingService();
    // The download fails to connect, which is logged after the messages
    // checked here.
    const dataFile = standInDataFile({
      updateOnStart: true,
      updateUrl: 'http://127.0.0.1:1/datafile',
      tempDataDirectory: folder,
      path: file
    });
    service.registerDataFile(dataFile);
    expect(messages(logs)[0]).toBe('info: Updating on start-up');
  });

  test('a file system watcher is logged', async () => {
    const { service, logs } = loggingService();
    const dataFile = standInDataFile({
      autoUpdate: true,
      pollingInterval: 60,
      updateTimeMaximumRandomisation: 1,
      getNextUpdate: () => new Date(),
      fileSystemWatcher: true,
      path: file
    });
    jest.useFakeTimers();
    try {
      service.registerDataFile(dataFile);
    } finally {
      jest.useRealTimers();
    }
    expect(messages(logs)).toContain('info: Creating file system watcher');
  });

  test('a download and a refresh are logged', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file,
        getDatePublished: () => new Date(Date.UTC(2026, 0, 1))
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      expect(await done).toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
      expect(messages(logs)).toEqual([
        'info: Checking for update',
        "info: Checking for update from '" + remote.url +
          "' for Engine 'TestEngine'",
        "info: Downloaded new data from '" + remote.url +
          "' for Engine 'TestEngine'",
        "info: Attempting to refresh Engine 'TestEngine' with new data"
      ]);
    } finally {
      stop(remote.server);
    }
  });

  test('a 304 response is logged', async () => {
    const remote = await serve(304, '');
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file,
        getDatePublished: () => new Date(Date.UTC(2026, 5, 1, 12, 0, 0))
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      await done;
      expect(messages(logs)).toContain(
        'info: No data newer than Mon, 01 Jun 2026 12:00:00 GMT found at \'' +
        remote.url + "' for Engine 'TestEngine'");
    } finally {
      stop(remote.server);
    }
  });

  test('a connection failure is a warning, with the retry sentence only ' +
    'for an automatic update', async () => {
    const run = async (automatic) => {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: 'http://127.0.0.1:1/datafile',
        tempDataDirectory: folder,
        autoUpdate: false
      });
      const done = completed(service);
      service.updateDataFile(dataFile, automatic);
      await done;
      return logs.find((log) => log.level === 'warn');
    };
    const procedural = await run(false);
    expect(procedural.message).toMatch(
      /^An error occurred when connecting to http:\/\/127\.0\.0\.1:1\/datafile in order to check for data file updates for TestEngine\. Error detail: /);

    const { service, logs } = loggingService();
    const dataFile = standInDataFile({
      updateUrl: 'http://127.0.0.1:1/datafile',
      tempDataDirectory: folder,
      autoUpdate: true,
      pollingInterval: 30,
      updateTimeMaximumRandomisation: 10,
      getNextUpdate: () => new Date(0)
    });
    const timer = jest.spyOn(global, 'setTimeout')
      .mockImplementation(() => ({ unref: () => {} }));
    const done = completed(service);
    service.updateDataFile(dataFile, true);
    await done;
    timer.mockRestore();
    const automatic = logs.find((log) => log.level === 'warn');
    expect(automatic.message).toMatch(
      /^An error occurred when connecting to http:\/\/127\.0\.0\.1:1\/datafile in order to check for data file updates for TestEngine\. Update will be attempted again later\. Error detail: /);
  });

  test('a failed refresh is an error', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file,
        refresh: () => {
          throw new Error('The data cannot be used.');
        }
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      await done;
      const error = logs.find((log) => log.level === 'error');
      expect(error.message).toBe('An error occurred while applying a data ' +
        'file update to TestEngine. Error detail: The data cannot be used.');
    } finally {
      stop(remote.server);
    }
  });

  test('a failed integrity check is a warning', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file,
        verifyMD5: true
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      expect(await done)
        .toBe(AutoUpdateStatus.AUTO_UPDATE_ERR_MD5_VALIDATION_FAILED);
      const warning = logs.find((log) => log.level === 'warn');
      expect(warning.message).toMatch(
        /^An error occurred during the integrity check of new data file for TestEngine\. Error detail: /);
    } finally {
      stop(remote.server);
    }
  });

  test('an error response is a warning that names the download', async () => {
    const remote = await serve(429, '');
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      expect(await done)
        .toBe(AutoUpdateStatus.AUTO_UPDATE_ERR_429_TOO_MANY_ATTEMPTS);
      const warning = logs.find((log) => log.level === 'warn');
      expect(warning.message).toMatch(new RegExp(
        '^An error occurred while downloading a data file update for ' +
        'TestEngine from ' + remote.url.replace(/[.]/g, '\\.') +
        '\\. Error detail: '));
    } finally {
      stop(remote.server);
    }
  });

  test('a data file with no temporary directory is an error', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        identifier: 'HashV41',
        tempDataDirectory: undefined
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      await done;
      expect(logs.find((log) => log.level === 'error').message).toBe(
        "The data file 'HashV41' is checking for updates but does not " +
        'have a temporary file path configured.');
      expect(dataFile.updating).toBe(false);
    } finally {
      stop(remote.server);
    }
  });

  test('a data file that cannot be copied over is an error', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service, logs } = loggingService();
      const target = path.join(folder, 'missing-folder', 'data.dat');
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: target
      });
      const done = completed(service);
      service.updateDataFile(dataFile);
      await done;
      await sleep(50);
      expect(logs.find((log) => log.level === 'error').message).toBe(
        'An error occurred when copying a data file to replace the ' +
        'existing one at \'' + target + '\'.');
    } finally {
      stop(remote.server);
    }
  });
});

describe('file system watcher', () => {
  test('is not created while autoUpdate is off', () => {
    const folder = newFolder();
    const file = path.join(folder, 'data.dat');
    fs.writeFileSync(file, 'version 1');
    const { service, logs } = loggingService();
    const watch = jest.spyOn(fs, 'watch');
    try {
      service.registerDataFile(standInDataFile({
        autoUpdate: false,
        fileSystemWatcher: true,
        path: file
      }));
      expect(watch).not.toHaveBeenCalled();
      expect(logs.map((log) => log.message))
        .not.toContain('Creating file system watcher');
    } finally {
      watch.mockRestore();
    }
  });
});

describe('every update reports one status', () => {
  let folder;
  let file;

  beforeEach(() => {
    folder = newFolder();
    file = path.join(folder, 'data.dat');
    fs.writeFileSync(file, 'version 1');
  });

  // Records each status, and whether the data file was still marked as
  // updating when it was reported.
  const record = (service, dataFile) => {
    const seen = [];
    service.on('updateComplete', (status) => {
      seen.push({ status, updating: dataFile.updating });
    });
    return seen;
  };

  test('a URL that cannot be parsed is reported and does not leave the ' +
    'data file updating', async () => {
    const { service } = loggingService();
    const dataFile = standInDataFile({
      updateUrl: 'not a url',
      tempDataDirectory: folder
    });
    const seen = record(service, dataFile);
    expect(() => service.updateDataFile(dataFile, true)).not.toThrow();
    await sleep(100);
    expect(seen).toEqual([
      { status: AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR, updating: false }
    ]);
    expect(dataFile.updating).toBe(false);
  });

  test('a download that is cut short is reported', async () => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, { 'content-length': '1000' });
      response.write('version');
      setTimeout(() => request.socket.destroy(), 50);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { service } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: 'http://127.0.0.1:' + server.address().port + '/datafile',
        tempDataDirectory: folder,
        path: file
      });
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(500);
      expect(seen).toEqual([
        { status: AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR, updating: false }
      ]);
      expect(dataFile.data).toBeUndefined();
      expect(dataFile.updating).toBe(false);
    } finally {
      stop(server);
    }
  });

  // A reset raises an error on the request whilst the response is still
  // arriving, and then closes the response. Each would report the update
  // and schedule the next check.
  test('a connection reset part way through the download is reported ' +
    'once and schedules one check', async () => {
    const server = http.createServer((request, response) => {
      response.writeHead(200, { 'content-length': '1000' });
      response.write('version');
      setTimeout(() => request.socket.resetAndDestroy(), 50);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: 'http://127.0.0.1:' + server.address().port + '/datafile',
        tempDataDirectory: folder,
        path: file
      });
      const checks = jest.spyOn(service, 'checkNextUpdate');
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(500);
      expect(seen).toEqual([
        { status: AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR, updating: false }
      ]);
      expect(checks).toHaveBeenCalledTimes(1);
      expect(logs.filter((log) => log.level === 'warn')
        .map((log) => log.message)).toEqual([
        'An error occurred while downloading a data file update for ' +
        'TestEngine from ' + dataFile.updateUrl + '. Error detail: The ' +
        'connection closed before the whole file was received.'
      ]);
      expect(fs.readdirSync(folder)).toEqual(['data.dat']);
    } finally {
      stop(server);
    }
  });

  test('a data file that is locked is an error reported once', async () => {
    const remote = await serve(200, 'version 2');
    const writeFile = fs.writeFile;
    const locked = jest.spyOn(fs, 'writeFile').mockImplementation(
      (name, data, callback) => {
        if (name === file) {
          callback(Object.assign(new Error('resource busy or locked'),
            { code: 'EBUSY' }));
        } else {
          writeFile(name, data, callback);
        }
      });
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file
      });
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(1000);
      expect(seen).toEqual([
        {
          status: AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME,
          updating: false
        }
      ]);
      expect(logs.filter((log) => log.level === 'error')
        .map((log) => log.message)).toEqual([
        'Unable to update data file. This is probably because the Engine ' +
        'was built with the ‘use temp file’ option disabled.'
      ]);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    } finally {
      locked.mockRestore();
      stop(remote.server);
    }
  });

  test('a download that cannot be read is an error reported once',
    async () => {
      const remote = await serve(200, 'version 2');
      const readFile = fs.readFile;
      const failing = jest.spyOn(fs, 'readFile').mockImplementation(
        (name, ...rest) => {
          if (String(name).startsWith(folder)) {
            rest[rest.length - 1](Object.assign(new Error('cannot read'),
              { code: 'EACCES' }));
          } else {
            readFile(name, ...rest);
          }
        });
      try {
        const { service, logs } = loggingService();
        const dataFile = standInDataFile({
          updateUrl: remote.url,
          tempDataDirectory: folder,
          path: file
        });
        const seen = record(service, dataFile);
        service.updateDataFile(dataFile);
        await sleep(1000);
        expect(seen).toEqual([
          {
            status: AutoUpdateStatus.AUTO_UPDATE_MASTER_FILE_CANT_RENAME,
            updating: false
          }
        ]);
        const errors = logs.filter((log) => log.level === 'error');
        expect(errors).toHaveLength(1);
        expect(errors[0].message).toMatch(
          /^An error occurred when writing to .+\. Error detail: .*cannot read/);
        expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
      } finally {
        failing.mockRestore();
        stop(remote.server);
      }
    });

  test('a download the MD5 check cannot read is reported once and ' +
    'removed', async () => {
    const remote = await serve(200, 'version 2');
    const createReadStream = fs.createReadStream;
    const failing = jest.spyOn(fs, 'createReadStream').mockImplementation(
      (name, ...rest) => {
        if (String(name).startsWith(folder)) {
          const stream = new Readable({ read () {} });
          process.nextTick(() => stream.destroy(
            Object.assign(new Error('cannot read'), { code: 'EIO' })));
          return stream;
        }
        return createReadStream(name, ...rest);
      });
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file,
        verifyMD5: true
      });
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(1000);
      expect(seen).toEqual([
        {
          status: AutoUpdateStatus.AUTO_UPDATE_ERR_READING_STREAM,
          updating: false
        }
      ]);
      const errors = logs.filter((log) => log.level === 'error');
      expect(errors).toHaveLength(1);
      expect(errors[0].message).toContain('cannot read');
      expect(fs.readdirSync(folder)).toEqual(['data.dat']);
      expect(fs.readFileSync(file, 'utf8')).toBe('version 1');
    } finally {
      failing.mockRestore();
      stop(remote.server);
    }
  });

  test('a copy that fails is reported once', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: path.join(folder, 'missing-folder', 'data.dat')
      });
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(1000);
      expect(seen).toEqual([
        {
          status: AutoUpdateStatus.AUTO_UPDATE_NEW_FILE_CANT_RENAME,
          updating: false
        }
      ]);
    } finally {
      stop(remote.server);
    }
  });

  test('a download that cannot be removed after a good refresh is a ' +
    'success reported once', async () => {
    const remote = await serve(200, 'version 2');
    const unlink = jest.spyOn(fs, 'unlink').mockImplementation(
      (name, callback) => callback(new Error('cannot remove')));
    try {
      const { service, logs } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file
      });
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(1000);
      expect(seen).toEqual([
        { status: AutoUpdateStatus.AUTO_UPDATE_SUCCESS, updating: false }
      ]);
      expect(logs.some((log) => log.level === 'error' &&
        log.message.includes('cannot remove'))).toBe(true);
    } finally {
      unlink.mockRestore();
      stop(remote.server);
    }
  });

  test('a failed refresh is reported after the data file stops ' +
    'updating', async () => {
    const remote = await serve(200, 'version 2');
    try {
      const { service } = loggingService();
      const dataFile = standInDataFile({
        updateUrl: remote.url,
        tempDataDirectory: folder,
        path: file,
        refresh: () => {
          throw new Error('The data cannot be used.');
        }
      });
      const seen = record(service, dataFile);
      service.updateDataFile(dataFile);
      await sleep(1000);
      expect(seen).toEqual([
        { status: AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED, updating: false }
      ]);
    } finally {
      stop(remote.server);
    }
  });
});
