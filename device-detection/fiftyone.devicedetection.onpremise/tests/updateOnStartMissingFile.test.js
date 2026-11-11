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

// The Data update page of the pipeline specification says that updating on
// start-up can bootstrap an engine that has no data file, and that it fails
// where the download fails and there is no file. These tests give the engine
// a path with no file at it and a server of their own to download from.

const fs = require('fs');
const http = require('http');
const os = require('os');
const path = require('path');
const zlib = require('zlib');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const DeviceDetectionOnPremisePipelineBuilder = require51(
  'fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder;

const DataFile = path.resolve((process.env.directory || __dirname) +
  '/../../../cxx/data/device-detection/51Degrees-LiteV4.1.hash');

const MobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) ' +
  'AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile' +
  '/11D167 Safari/9537.53';

// Answers every request with the status given, and the compressed data file
// where the status is 200. The headers of each request are kept in the list
// given, if there is one.
const serve = (status, requests = []) => new Promise((resolve) => {
  const body = status === 200
    ? zlib.gzipSync(fs.readFileSync(DataFile))
    : Buffer.alloc(0);
  const server = http.createServer((request, response) => {
    requests.push(request.headers);
    response.statusCode = status;
    response.end(body);
  });
  server.listen(0, '127.0.0.1', () => resolve(server));
});

const stop = (server) => {
  server.closeAllConnections();
  server.close();
};

const builderFor = (server, folder, updateOnStart) =>
  new DeviceDetectionOnPremisePipelineBuilder({
    dataFile: path.join(folder, 'missing.hash'),
    shareUsage: false,
    autoUpdate: false,
    fileSystemWatcher: false,
    updateOnStart,
    licenceKeys: 'not-a-real-key',
    dataUpdateUrl: 'http://127.0.0.1:' + server.address().port + '/download',
    dataUpdateVerifyMd5: false,
    createTempDataCopy: true,
    tempDataDir: folder
  });

describe('update on start-up with no data file', () => {
  let folder;
  let server;

  beforeEach(() => {
    folder = fs.mkdtempSync(path.join(os.tmpdir(), 'missing-file-'));
  });

  afterEach(() => {
    stop(server);
  });

  test('downloads the data file and then processes with it', async () => {
    server = await serve(200);
    const pipeline = builderFor(server, folder, true).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', MobileUserAgent);
    await flowData.process();
    expect(fs.existsSync(path.join(folder, 'missing.hash'))).toBe(true);
    expect(flowData.device.ismobile.value).toBe(true);
  });

  // The engine has no published date before it has data, and there is no
  // file to take a date from, so the request asks for the file whatever
  // its date.
  test('asks for the data file with no If-Modified-Since header', async () => {
    const requests = [];
    server = await serve(200, requests);
    const pipeline = builderFor(server, folder, true).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', MobileUserAgent);
    await flowData.process();
    expect(requests.length).toBeGreaterThan(0);
    expect(requests[0]).not.toHaveProperty('if-modified-since');
  });

  test('fails to process where the download fails', async () => {
    server = await serve(500);
    const pipeline = builderFor(server, folder, true).build();
    const logged = [];
    pipeline.on('error', (message) => logged.push(String(message)));
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', MobileUserAgent);
    await expect(flowData.process()).rejects.toBeDefined();
    expect(logged.some((message) => message.includes(
      'There is no file at \'' + path.join(folder, 'missing.hash') + '\'')))
      .toBe(true);
  });

  test('still fails to build where the engine does not update on ' +
    'start-up', async () => {
    server = await serve(200);
    let error;
    try {
      builderFor(server, folder, false).build();
    } catch (e) {
      error = e;
    }
    expect(String(error)).toContain(
      'There is no file at \'' + path.join(folder, 'missing.hash') + '\'');
  });
});
