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
const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const net = require('net');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));
const Pipeline = require(
  path.resolve(__dirname, '..', '..', 'fiftyone.pipeline.core', 'pipeline'));

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// A new folder holding a data file at version 1.
const newDataFile = (prefix) => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  const file = path.join(folder, 'data.dat');
  fs.writeFileSync(file, 'version 1');
  return { folder, file };
};

// A data file is watched only while autoUpdate is on. The wait for its
// next update is never run, because the timer is replaced while it is
// registered.
const watchedOptions = {
  fileSystemWatcher: true,
  autoUpdate: true,
  pollingInterval: 60,
  updateTimeMaximumRandomisation: 1,
  getNextUpdate: () => new Date()
};

const register = (updateService, dataFile) => {
  jest.useFakeTimers();
  try {
    updateService.registerDataFile(dataFile);
  } finally {
    jest.useRealTimers();
  }
};

// Stands in for an engine that keeps the data it has when a refresh fails.
// The refresh fails if the file does not start with 'version'.
const standInDataFile = (file) => ({
  path: file,
  autoUpdate: false,
  updateOnStart: false,
  attemptedDownload: false,
  updating: false,
  flowElement: { dataKey: 'testEngine' },
  data: fs.readFileSync(file, 'utf8'),
  finished: false,
  refresh: function () {
    if (this.finished) {
      return;
    }
    const content = fs.readFileSync(file, 'utf8');
    if (!content.startsWith('version')) {
      throw new Error('The data file cannot be used.');
    }
    this.data = content;
  }
});

// Resolves at the first updateComplete event with the status given.
const next = (updateService, status) => new Promise((resolve) => {
  updateService.on('updateComplete', function (completed) {
    if (completed === status) {
      resolve();
    }
  });
});

// Keeps each updateComplete status in the order it was emitted.
const recordStatuses = (updateService) => {
  const statuses = [];
  updateService.on('updateComplete', (status) => statuses.push(status));
  return statuses;
};

// Answers every request with the status and body given. The response ends a
// moment after its body, because the update route reads the download when
// the response ends rather than when the file is written.
const serve = (status, body) => new Promise((resolve) => {
  const server = http.createServer((request, response) => {
    response.statusCode = status;
    response.write(body);
    setTimeout(() => response.end(), 100);
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const stop = (server) => {
  server.closeAllConnections();
  server.close();
};

// Points the data file's update route at the server given.
const downloadFrom = (dataFile, server, folder) => Object.assign(dataFile, {
  updateUrl: 'http://127.0.0.1:' + server.address().port + '/datafile',
  verifyIfModifiedSince: false,
  verifyMD5: false,
  decompress: false,
  tempDataDirectory: folder,
  identifier: 'download'
});

// Resolves once the update route has removed its download, which is the last
// step of the route, and the callback of that removal has run.
const downloadRemoved = async (folder) => {
  for (let i = 0; i < 200; i++) {
    if (!fs.readdirSync(folder).some((name) => name.startsWith('download'))) {
      await sleep(50);
      return;
    }
    await sleep(10);
  }
  throw new Error('The update route did not remove its download.');
};

/**
 * A request that fails at the connection level (for example reset by
 * the server) must report the failure through the updateComplete event
 * rather than crashing the process with an unhandled 'error' event.
 */
test('data file update connection failure emits updateComplete', done => {
  // A server that accepts the connection and immediately destroys the
  // socket, so the client receives a reset instead of a response.
  const server = net.createServer(function (socket) {
    socket.destroy();
  });

  server.listen(0, '127.0.0.1', function () {
    const port = server.address().port;

    const updateService = new DataFileUpdateService({
      log: function () {}
    });

    // Minimal stand-in for a DataFile. autoUpdate false keeps
    // checkNextUpdate from scheduling a retry timer after the failure.
    const dataFile = {
      updateUrl: 'http://127.0.0.1:' + port + '/datafile',
      verifyIfModifiedSince: false,
      autoUpdate: false,
      updateOnStart: false,
      attemptedDownload: false,
      updating: false,
      flowElement: { dataKey: 'testEngine' }
    };

    updateService.once('updateComplete', function (status, file) {
      server.close(function () {
        expect(status).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);
        expect(file).toBe(dataFile);
        expect(file.updating).toBe(false);
        done();
      });
    });

    updateService.updateDataFile(dataFile);
  });
});

/**
 * A refresh that fails on the file watcher route must be logged and reported
 * through the updateComplete event, as on the update route, rather than
 * thrown, which ends the process. The watcher must then pick up a later good
 * file.
 */
test('file watcher keeps watching after a failed refresh', async () => {
  const { file } = newDataFile('watcher-');
  const logs = [];
  const updateService = new DataFileUpdateService({
    log: function (level, message) {
      logs.push({ level, message });
    }
  });
  const dataFile = Object.assign(standInDataFile(file),
    watchedOptions);

  try {
    register(updateService, dataFile);
    // On macOS fs.watch can miss a change made straight after it starts,
    // which leaves the test waiting for an event that never comes.
    await sleep(500);

    const failed = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
    fs.writeFileSync(file, 'unusable');
    await failed;
    expect(dataFile.data).toBe('version 1');
    const error = logs.find((log) => log.level === 'error');
    expect(error.message).toBe('An error occurred while applying a data ' +
      'file update to testEngine. Error detail: The data file cannot be ' +
      'used.');
    // The test resumes before the watcher has finished with the first
    // change, and on macOS a change made then is never reported.
    await sleep(500);

    const refreshed = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    fs.writeFileSync(file, 'version 2');
    await refreshed;
    expect(dataFile.data).toBe('version 2');
  } finally {
    // The folder is left in place. On Windows, removing the folder of a
    // watched file makes fs.watch raise an error that nothing handles.
    dataFile.finished = true;
    fs.unlinkSync(file);
  }
});

/**
 * With a pipeline that has no 'error' listener, a refresh that fails on the
 * file watcher route is written to the console rather than thrown, and the
 * watcher picks up a later good file.
 */
test('file watcher with no error listener writes a failed refresh to the ' +
  'console', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { file } = newDataFile('watcher-');
  const updateService = new DataFileUpdateService(new Pipeline([]));
  const dataFile = Object.assign(standInDataFile(file),
    watchedOptions);

  try {
    register(updateService, dataFile);
    // The watcher is given time to start, as in the test above.
    await sleep(500);

    const failed = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
    fs.writeFileSync(file, 'unusable');
    await failed;
    expect(dataFile.data).toBe('version 1');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Error detail: The data file cannot be used.'));
    // As in the test above.
    await sleep(500);

    const refreshed = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    fs.writeFileSync(file, 'version 2');
    await refreshed;
    expect(dataFile.data).toBe('version 2');
  } finally {
    // The folder is left in place, as in the test above.
    dataFile.finished = true;
    fs.unlinkSync(file);
    consoleError.mockRestore();
  }
});

/**
 * With an 'error' listener, a refresh that fails on the file watcher route
 * goes to the listener and nothing is written to the console.
 */
test('file watcher with an error listener reports a failed refresh to it',
  async () => {
    const consoleError = jest.spyOn(console, 'error')
      .mockImplementation(() => {});
    const { file } = newDataFile('watcher-');
    const pipeline = new Pipeline([]);
    const heard = [];
    pipeline.on('error', (message) => heard.push(message));
    const updateService = new DataFileUpdateService(pipeline);
    const dataFile = Object.assign(standInDataFile(file),
      watchedOptions);

    try {
      register(updateService, dataFile);
      // The watcher is given time to start, as in the tests above.
      await sleep(500);

      const failed = next(updateService,
        AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
      fs.writeFileSync(file, 'unusable');
      await failed;
      expect(heard[0]).toContain(
        'Error detail: The data file cannot be used.');
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      // The folder is left in place, as in the tests above.
      dataFile.finished = true;
      fs.unlinkSync(file);
      consoleError.mockRestore();
    }
  });

/**
 * A download the server refuses is reported as a warning, as the data update
 * page of the specification says, and nothing is thrown.
 */
test('update route reports a refused download as a warning', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { folder, file } = newDataFile('update-');
  const server = await serve(403, 'refused');
  const pipeline = new Pipeline([]);
  const warnings = [];
  pipeline.on('warn', (message) => warnings.push(message));
  const updateService = new DataFileUpdateService(pipeline);
  const dataFile = downloadFrom(standInDataFile(file), server, folder);

  try {
    const refused = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_ERR_403_FORBIDDEN);
    updateService.updateDataFile(dataFile);
    await refused;
    expect(warnings.some((message) => message.includes(
      'An error occurred while downloading a data file update for testEngine ' +
      'from ' + dataFile.updateUrl))).toBe(true);
    expect(consoleError).not.toHaveBeenCalled();
    expect(dataFile.updating).toBe(false);
  } finally {
    stop(server);
    fs.rmSync(folder, { recursive: true, force: true });
    consoleError.mockRestore();
  }
});

/**
 * With a pipeline that has no 'error' listener, a refresh that fails on the
 * update route is written to the console rather than thrown, the data in use
 * is kept, and no success is reported after the failure.
 */
test('update route with no error listener writes a failed refresh to the ' +
  'console', async () => {
  const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
  const { folder, file } = newDataFile('update-');
  const server = await serve(200, 'unusable');
  const updateService = new DataFileUpdateService(new Pipeline([]));
  const statuses = recordStatuses(updateService);
  const dataFile = downloadFrom(standInDataFile(file), server, folder);

  try {
    const failed = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
    updateService.updateDataFile(dataFile);
    await failed;
    await downloadRemoved(folder);
    expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED]);
    expect(dataFile.data).toBe('version 1');
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('Error detail: The data file cannot be used.'));
  } finally {
    stop(server);
    fs.rmSync(folder, { recursive: true, force: true });
    consoleError.mockRestore();
  }
});

/**
 * A refresh that fails on the update route is reported to an 'error'
 * listener, and no success is reported after it.
 */
test('update route reports a failed refresh with no success after it',
  async () => {
    const consoleError = jest.spyOn(console, 'error')
      .mockImplementation(() => {});
    const { folder, file } = newDataFile('update-');
    const server = await serve(200, 'unusable');
    const pipeline = new Pipeline([]);
    const heard = [];
    pipeline.on('error', (message) => heard.push(message));
    const updateService = new DataFileUpdateService(pipeline);
    const statuses = recordStatuses(updateService);
    const dataFile = downloadFrom(standInDataFile(file), server, folder);

    try {
      const failed = next(updateService,
        AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
      updateService.updateDataFile(dataFile);
      await failed;
      await downloadRemoved(folder);
      expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED]);
      expect(heard[0]).toContain(
        'Error detail: The data file cannot be used.');
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      stop(server);
      fs.rmSync(folder, { recursive: true, force: true });
      consoleError.mockRestore();
    }
  });

/**
 * A good file on the update route is loaded and reported as a success.
 */
test('update route reports a good file as a success', async () => {
  const { folder, file } = newDataFile('update-');
  const server = await serve(200, 'version 2');
  const updateService = new DataFileUpdateService(new Pipeline([]));
  const statuses = recordStatuses(updateService);
  const dataFile = downloadFrom(standInDataFile(file), server, folder);

  try {
    const refreshed = next(updateService,
      AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    updateService.updateDataFile(dataFile);
    await refreshed;
    expect(statuses).toEqual([AutoUpdateStatus.AUTO_UPDATE_SUCCESS]);
    expect(dataFile.data).toBe('version 2');
  } finally {
    stop(server);
    fs.rmSync(folder, { recursive: true, force: true });
  }
});

// Registers, with a new update service, a data file that is watched for
// changes and one that waits about an hour for its next update, and keeps
// none of them. The wait is on fake timers, so that it never runs and does not
// keep the process alive.
const registerAndDrop = (file, registry) => {
  const updateService = new DataFileUpdateService({ log: function () {} });
  const watched = Object.assign(standInDataFile(file),
    watchedOptions);
  const scheduled = Object.assign(standInDataFile(file), {
    autoUpdate: true,
    pollingInterval: 60,
    updateTimeMaximumRandomisation: 1,
    getNextUpdate: () => new Date()
  });
  jest.useFakeTimers();
  try {
    updateService.registerDataFile(watched);
    updateService.registerDataFile(scheduled);
  } finally {
    jest.useRealTimers();
  }
  registry.register(watched, 'watched');
  registry.register(scheduled, 'scheduled');
};

/**
 * Neither the file watcher nor the timer for the next update keeps a data file
 * alive once the application has dropped it and its update service, because
 * a data file keeps its engine, and so the engine's native memory, alive.
 * Needs node --expose-gc, which the unit-test script passes.
 */
test('watched and scheduled data files can be collected once dropped',
  async () => {
    const { file } = newDataFile('collected-');
    let collected = 0;
    const registry = new FinalizationRegistry(() => { collected++; });

    registerAndDrop(file, registry);
    // The count changes in the registry's callback, not in the loop, so it
    // is checked in the body rather than in the condition.
    for (let i = 0; i < 20; i++) {
      if (collected === 2) {
        break;
      }
      global.gc();
      await sleep(50);
    }

    // The folder is left in place, as in the watcher tests above.
    expect(collected).toBe(2);
  });
