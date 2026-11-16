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

// The Data update page of the pipeline specification says that a check for
// an update MUST be reported to onUpdateCallbacks once it ends, including
// the checks made by the file watcher, and that In progress is the status
// of a file watcher event that found nothing left to do. A download writes
// the new data to the path the watcher watches, so events arrive while the
// service's own check is still being applied, and each is reported as in
// progress before that check reports its own result. These tests show that
// happening, and show what a caller that takes the first report as its
// result is handed.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));

// Each test downloads over a loopback server, which is quick, but the
// refresh and the clean up afterwards can be slow on a loaded runner.
const DownloadTestMilliseconds = 30000;

class TestEngine {
  constructor () {
    this.dataKey = 'testEngine';
  }
}

const newFolder = () => fs.mkdtempSync(path.join(os.tmpdir(), 'watched-dl-'));

// Answers every request with the body given.
const serve = (body) => new Promise((resolve) => {
  const server = http.createServer((request, response) => {
    response.statusCode = 200;
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

// The statuses that say how a check ended. In progress says a check found
// nothing left to do, so it is not the result of anything.
const endsCheck = (status) =>
  status !== AutoUpdateStatus.AUTO_UPDATE_IN_PROGRESS;

// A data file at version 1 on disk, watched, with a download of version 2
// waiting on a server of this test's own. The listener fs.watch is given is
// kept, so that a test raises a watcher event itself rather than waiting
// for the operating system to raise one.
const watchedDownload = async () => {
  const folder = newFolder();
  const file = path.join(folder, 'data.dat');
  fs.writeFileSync(file, 'version 1');
  const served = await serve('version 2');
  const logs = [];
  const service = new DataFileUpdateService({
    log: (level, message) => logs.push({ level, message })
  });
  const statuses = [];
  service.on('updateComplete', (status) => statuses.push(status));
  const watchers = [];
  const watch = fs.watch;
  const spy = jest.spyOn(fs, 'watch').mockImplementation(
    (watchedPath, options, listener) => {
      watchers.push(listener);
      return watch(watchedPath, options, listener);
    });
  const loaded = [];
  const dataFile = Object.assign({
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: true,
    attemptedDownload: false,
    updating: false,
    verifyIfModifiedSince: false,
    verifyMD5: false,
    decompress: false,
    identifier: 'test',
    flowElement: new TestEngine(),
    path: file,
    updateUrl: served.url,
    refresh: () => loaded.push(fs.readFileSync(file, 'utf8'))
  });
  service.registerDataFile(dataFile);
  return {
    dataFile, service, statuses, logs, loaded, spy, file,
    server: served.server,
    // Raises one event on every watcher the service made for this file.
    raiseWatcherEvent: () => watchers.forEach((listener) => listener('change'))
  };
};

const until = (test, milliseconds) => new Promise((resolve, reject) => {
  const started = Date.now();
  const check = () => {
    if (test()) {
      resolve();
    } else if (Date.now() - started > milliseconds) {
      reject(new Error('The wait ended with nothing to show'));
    } else {
      setTimeout(check, 10);
    }
  };
  check();
});

describe('a watcher event while the service is downloading', () => {
  let watched;

  afterEach(() => {
    if (watched) {
      watched.spy.mockRestore();
      stop(watched.server);
      fs.rmSync(path.dirname(watched.file), { recursive: true, force: true });
      watched = undefined;
    }
  });

  // The watcher event is raised by this test straight after the download
  // starts, which is the state the service's own write to the watched path
  // puts it in, and is reported before the download finishes.
  test('is reported as in progress before the download reports its own ' +
    'result', async () => {
    watched = await watchedDownload();
    watched.service.updateDataFile(watched.dataFile);
    expect(watched.dataFile.updating).toBe(true);
    watched.raiseWatcherEvent();
    expect(watched.statuses).toEqual([
      AutoUpdateStatus.AUTO_UPDATE_IN_PROGRESS]);
    await until(() => watched.statuses.some(endsCheck),
      DownloadTestMilliseconds);
    expect(watched.statuses[0])
      .toBe(AutoUpdateStatus.AUTO_UPDATE_IN_PROGRESS);
    expect(watched.statuses.filter(endsCheck))
      .toEqual([AutoUpdateStatus.AUTO_UPDATE_SUCCESS]);
    expect(watched.loaded).toEqual(['version 2']);
  }, DownloadTestMilliseconds);

  // What the two update data file examples did until this change. The first
  // report is not the result of the check they asked for.
  test('is what a caller waiting for one report is handed', async () => {
    watched = await watchedDownload();
    const first = new Promise((resolve) => {
      watched.service.once('updateComplete', (status) => resolve(status));
    });
    watched.service.updateDataFile(watched.dataFile);
    watched.raiseWatcherEvent();
    await expect(first).resolves
      .toBe(AutoUpdateStatus.AUTO_UPDATE_IN_PROGRESS);
  }, DownloadTestMilliseconds);

  // What they do now. A caller that waits for a status that ends a check is
  // handed the result of its own check, whatever the watcher reports first.
  test('is passed over by a caller waiting for a status that ends a check',
    async () => {
      watched = await watchedDownload();
      const ended = new Promise((resolve) => {
        let settled = false;
        watched.service.on('updateComplete', (status) => {
          if (!settled && endsCheck(status)) {
            settled = true;
            resolve(status);
          }
        });
      });
      watched.service.updateDataFile(watched.dataFile);
      watched.raiseWatcherEvent();
      await expect(ended).resolves
        .toBe(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    }, DownloadTestMilliseconds);
});
