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
      fileSystemWatcher: true,
      path: file
    });
    service.registerDataFile(dataFile);
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
