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

/**
 * @example onpremise/mixed/gettingstarted-api/gettingStarted.js
 *
 * This example runs a local version of the 51Degrees cloud API using
 * both the device detection and IP intelligence on-premise engines. See
 * the [cloud API documentation](https://cloud.51degrees.com/api-docs/index.html)
 * for details of the endpoints provided.
 *
 * The cloud examples can be run against this local API by setting the
 * 'FOD_CLOUD_API_URL' environment variable to 'http://localhost:5225/'.
 * Any value can be used for the resource key when using the local API.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-api/gettingStarted.js).
 *
 * Required data files:
 * - Device detection data file (.hash format)
 * - IP intelligence data file (.ipi format)
 *
 * The paths to the data files should be provided as 2 consecutive
 * command line parameters.
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.devicedetection.onpremise](https://www.npmjs.com/package/fiftyone.devicedetection.onpremise)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../../node_modules/', requestedPackage));
  } catch (e) {
    try {
      return require(path.join(__dirname, '/../../../../../', requestedPackage));
    } catch (e2) {
      return require(requestedPackage);
    }
  }
};

const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const zlib = require('zlib');

const core = require51('fiftyone.pipeline.core');

const DeviceDetectionOnPremise =
  require51('fiftyone.devicedetection.onpremise').DeviceDetectionOnPremise;

const IpIntelligenceOnPremise =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremise;

const ExampleUtils = require(path.join(__dirname, '/../../exampleUtils')).ExampleUtils;

// Device detection data file names in priority order.
const HASH_FILE_NAMES = [
  'TAC-HashV41.hash',
  '51Degrees-EnterpriseV4.1.hash',
  '51Degrees-LiteV4.1.hash'
];

// IP intelligence data file names in priority order.
const IPI_FILE_NAMES = [
  '51Degrees-EnterpriseIpiV41.ipi',
  '51Degrees-LiteV41.ipi'
];

// The port that the local API listens on. The same port is used by the
// cloud examples in the .NET version of this example.
const PORT = 5225;

// Pipeline and data file path to be used.
let pipeline;
let ipDataFilePath;

const setPipeline = (deviceDataFile, ipDataFile) => {
  ipDataFilePath = ipDataFile;

  // Create the device detection engine from scratch.
  const deviceEngine = new DeviceDetectionOnPremise({
    dataFilePath: deviceDataFile,
    performanceProfile: 'MaxPerformance',
    // inhibit auto-update of the data file for this example. An empty
    // license key disables automatic updates.
    licenceKeys: '',
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  });

  // Create the IP intelligence engine from scratch.
  const ipEngine = new IpIntelligenceOnPremise({
    dataFilePath: ipDataFile,
    performanceProfile: 'MaxPerformance',
    // inhibit auto-update of the data file for this example. An empty
    // license key disables automatic updates.
    licenceKeys: '',
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  });

  // Create a pipeline with both engines. The JSON bundler element added
  // by the pipeline builder produces the JSON response returned by the
  // /json endpoint.
  pipeline = new core.PipelineBuilder()
    .add(deviceEngine)
    .add(ipEngine)
    .build();

  pipeline.on('error', console.error);
};

// Returns the engine flow elements within the pipeline.
const getEngines = function () {
  return Object.values(pipeline.flowElements).filter(function (element) {
    return element.dataKey === 'device' || element.dataKey === 'ip';
  });
};

// Returns the accessible properties of all the engines in the format
// used by the cloud service.
const accessibleProperties = function (res) {
  const products = {};
  for (const engine of getEngines()) {
    const properties = [];
    Object.values(engine.properties).forEach(function (property) {
      properties.push({
        Name: property.name,
        Type: property.type,
        Category: property.category,
        DelayExecution: false
      });
    });
    products[engine.dataKey] = { Properties: properties };
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify({ Products: products }));
};

// Returns the distinct evidence keys accepted by the engines in the
// pipeline.
const evidenceKeys = function (res) {
  const keys = new Set();
  for (const engine of getEngines()) {
    for (const key of engine.evidenceKeyFilter.list) {
      keys.add(key);
    }
  }
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(Array.from(keys)));
};

// Processes the evidence provided in the request and returns the JSON
// response produced by the JSON bundler element.
const processEvidence = function (req, res, query, body) {
  const flowData = pipeline.createFlowData();

  // Add the query string parameters and any form body values as query
  // evidence, and the headers and cookies from the request.
  flowData.evidence.addFromRequest(req);
  for (const [key, value] of Object.entries(query)) {
    flowData.evidence.add('query.' + key, value);
  }
  for (const [key, value] of Object.entries(body)) {
    flowData.evidence.add('query.' + key, value);
  }

  flowData.process().then(function () {
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify(flowData.jsonbundler.json));
  });
};

// Returns the IP intelligence data file compressed with gzip. Used by
// the data file update examples as a local distributor.
const downloadIpiGz = function (res) {
  const compressed = zlib.gzipSync(fs.readFileSync(ipDataFilePath));
  const md5 = crypto.createHash('md5').update(compressed).digest('hex');
  res.setHeader('Content-Type', 'application/gzip');
  res.setHeader(
    'Content-Disposition',
    `attachment; filename="${path.basename(ipDataFilePath)}.gz"`);
  res.setHeader('Content-MD5', md5);
  res.end(compressed);
};

const server = http.createServer((req, res) => {
  const parsed = new URL(req.url, `http://localhost:${PORT}`);
  const pathName = parsed.pathname.toLowerCase();
  const query = {};
  for (const [key, value] of parsed.searchParams) {
    query[key] = value;
  }

  // Read any form body before routing the request.
  let bodyText = '';
  req.on('data', function (chunk) {
    bodyText += chunk;
  });
  req.on('end', function () {
    const body = {};
    if (bodyText.length > 0 &&
      (req.headers['content-type'] || '')
        .indexOf('application/x-www-form-urlencoded') !== -1) {
      for (const [key, value] of new URLSearchParams(bodyText)) {
        body[key] = value;
      }
    }

    if (pathName === '/accessibleproperties' ||
      pathName.startsWith('/accessibleproperties/')) {
      accessibleProperties(res);
    } else if (pathName === '/evidencekeys' ||
      pathName.startsWith('/evidencekeys/')) {
      evidenceKeys(res);
    } else if (pathName === '/json' || pathName.endsWith('.json')) {
      processEvidence(req, res, query, body);
    } else if (pathName === '/download-ipi-gz') {
      downloadIpiGz(res);
    } else {
      res.statusCode = 404;
      res.end('Not found');
    }
  });
});

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);

  // Use the supplied path for the device detection data file or try to
  // find one in priority order. The 51DEGREES_DD_PATH environment
  // variable is checked before the folder hierarchy is searched.
  let deviceDataFile = args.length > 0 ? args[0] : undefined;
  if (deviceDataFile === undefined) {
    for (const fileName of HASH_FILE_NAMES) {
      deviceDataFile = ExampleUtils.findDeviceDataFile(fileName);
      if (deviceDataFile !== undefined) break;
    }
  }

  // Use the supplied path for the IP intelligence data file or try to
  // find one in priority order. The 51DEGREES_IPI_PATH environment
  // variable is checked before the folder hierarchy is searched.
  let ipDataFile = args.length > 1 ? args[1] : undefined;
  if (ipDataFile === undefined) {
    for (const fileName of IPI_FILE_NAMES) {
      ipDataFile = ExampleUtils.findDataFile(fileName);
      if (ipDataFile !== undefined) break;
    }
  }

  if (deviceDataFile !== undefined && ipDataFile !== undefined) {
    console.log(`Device detection data file: ${deviceDataFile}`);
    console.log(`IP intelligence data file: ${ipDataFile}`);
    setPipeline(deviceDataFile, ipDataFile);
    server.listen(PORT, '0.0.0.0');
    console.log(`Local cloud API listening on: http://localhost:${PORT}`);
  } else {
    if (deviceDataFile === undefined) {
      console.error('Failed to find a device detection data file. A ' +
        'lite data file is available from the device-detection-data ' +
        'repository on GitHub ' +
        'https://github.com/51Degrees/device-detection-data. The full ' +
        'path to a data file can be specified as the first command ' +
        'line argument');
    }
    if (ipDataFile === undefined) {
      console.error('Failed to find an IP intelligence data file. ' +
        'Make sure the ip-intelligence-data submodule has been updated ' +
        'by running `git submodule update --recursive`. The full path ' +
        'to a data file can be specified as the second command line ' +
        'argument');
    }
  }
};

// Export server object and set pipeline.
module.exports = {
  server,
  setPipeline
};
