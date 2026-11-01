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
const os = require('os');
const path = require('path');
const net = require('net');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));

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
 * file. The data file stands in for an engine that keeps the data it has
 * when a refresh fails.
 */
test('file watcher keeps watching after a failed refresh', async () => {
  const folder = fs.mkdtempSync(path.join(os.tmpdir(), 'watcher-'));
  const file = path.join(folder, 'data.dat');
  fs.writeFileSync(file, 'version 1');

  const logs = [];
  const updateService = new DataFileUpdateService({
    log: function (level, message) {
      logs.push({ level, message });
    }
  });

  let finished = false;
  const dataFile = {
    path: file,
    fileSystemWatcher: true,
    autoUpdate: false,
    updateOnStart: false,
    updating: false,
    data: 'version 1',
    refresh: function () {
      if (finished) {
        return;
      }
      const content = fs.readFileSync(file, 'utf8');
      if (!content.startsWith('version')) {
        throw new Error('The data file cannot be used.');
      }
      this.data = content;
    }
  };

  // Resolves at the first updateComplete event with the status given.
  const next = (status) => new Promise((resolve) => {
    updateService.on('updateComplete', function (completed) {
      if (completed === status) {
        resolve();
      }
    });
  });

  try {
    updateService.registerDataFile(dataFile);

    const failed = next(AutoUpdateStatus.AUTO_UPDATE_REFRESH_FAILED);
    fs.writeFileSync(file, 'unusable');
    await failed;
    expect(dataFile.data).toBe('version 1');
    expect(logs.length).toBeGreaterThan(0);
    expect(logs[0].level).toBe('error');
    expect(logs[0].message.message).toBe('The data file cannot be used.');

    const refreshed = next(AutoUpdateStatus.AUTO_UPDATE_SUCCESS);
    fs.writeFileSync(file, 'version 2');
    await refreshed;
    expect(dataFile.data).toBe('version 2');
  } finally {
    // The folder is left in place. On Windows, removing the folder of a
    // watched file makes fs.watch raise an error that nothing handles.
    finished = true;
    fs.unlinkSync(file);
  }
});
