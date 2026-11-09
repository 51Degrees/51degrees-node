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

const IpIntelligenceOnPremisePipelineBuilder = require51(
  'fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const DataFile = path.resolve((process.env.directory || __dirname) +
  '/../../../cxx/data/ip-intelligence/51Degrees-IPIV4AsnIpiV41.ipi');

const IpAddress = '8.8.8.8';

// Answers every request with the status given, and the compressed data file
// where the status is 200.
const serve = (status) => new Promise((resolve) => {
  const body = status === 200
    ? zlib.gzipSync(fs.readFileSync(DataFile))
    : Buffer.alloc(0);
  const server = http.createServer((request, response) => {
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
  new IpIntelligenceOnPremisePipelineBuilder({
    dataFile: path.join(folder, 'missing.ipi'),
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
    flowData.evidence.add('query.client-ip', IpAddress);
    await flowData.process();
    expect(fs.existsSync(path.join(folder, 'missing.ipi'))).toBe(true);
    expect(flowData.ip.swigResults).toBeDefined();
  });

  test('fails to process where the download fails', async () => {
    server = await serve(500);
    const pipeline = builderFor(server, folder, true).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', IpAddress);
    let error;
    try {
      await flowData.process();
    } catch (e) {
      error = e;
    }
    expect(String(error.message || error)).toContain(
      'There is no file at \'' + path.join(folder, 'missing.ipi') + '\'');
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
      'There is no file at \'' + path.join(folder, 'missing.ipi') + '\'');
  });
});
