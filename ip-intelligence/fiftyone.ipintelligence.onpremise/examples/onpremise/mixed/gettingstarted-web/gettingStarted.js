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
 * @example onpremise/mixed/gettingstarted-web/gettingStarted.js
 *
 * This example demonstrates using both device detection and IP
 * intelligence engines in a single web application pipeline. The
 * User-Agent and IP address of the requesting client are used as
 * evidence and details about the device, network, and location are
 * displayed.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-web/gettingStarted.js).
 *
 * Required data files:
 * - Device detection data file (.hash format)
 * - IP intelligence data file (.ipi format)
 *
 * This example can be configured using the 51d.json file. The paths to
 * the data files are taken from this configuration, and can be changed
 * by editing the file. Where a configured data file cannot be found, the
 * project directories are searched for a file with the same name.
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.devicedetection.onpremise](https://www.npmjs.com/package/fiftyone.devicedetection.onpremise)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 * - [pug](https://www.npmjs.com/package/pug)
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../../node_modules/', requestedPackage));
  } catch (e) {
    try {
      return require(requestedPackage);
    } catch (e2) {
      return require(requestedPackage);
    }
  }
};

const fs = require('fs');
const http = require('http');
const pug = require('pug');

const compiledFunction =
  pug.compileFile(path.join(__dirname, '/index.pug'));

const core = require51('fiftyone.pipeline.core');

const { DATA_FILE_AGE_WARNING, ExampleUtils, NEEDS_ENTERPRISE } =
  require(path.join(__dirname, '/../../exampleUtils'));

// Pipeline variable to be used
let pipeline;

// Check that the data files configured for each element exist, searching
// the project directories for a file with the same name where they do
// not. This allows the example to run from different working directories
// without a copy of the data files in each one. The _51DEGREES_DD_PATH
// and _51DEGREES_IPI_PATH environment variables are checked for explicit
// paths before the folder hierarchy is searched.
const fixDataFilePaths = (options) => {
  for (const element of options.PipelineOptions.Elements) {
    const parameters = element.elementParameters;
    if (parameters === undefined ||
      parameters.dataFilePath === undefined) {
      continue;
    }
    if (!fs.existsSync(parameters.dataFilePath)) {
      const fileName = path.basename(parameters.dataFilePath);
      const newDataFilePath = fileName.toLowerCase().endsWith('.hash')
        ? ExampleUtils.findDeviceDataFile(fileName)
        : ExampleUtils.findDataFile(fileName);
      if (newDataFilePath !== undefined) {
        parameters.dataFilePath = newDataFilePath;
        console.warn('Failed to find a data file at the specified ' +
          `path. Using '${newDataFilePath}' instead.`);
      } else {
        throw 'Failed to find a data file at ' +
          `'${parameters.dataFilePath}'. Ensure that the filename is ` +
          'correct in 51d.json. If using the lite files, then make sure ' +
          'the cxx/data submodule has been fetched by running ' +
          '\'git submodule update --init --recursive\'.';
      }
    }
  }
};

const setPipeline = (options) => {
  fixDataFilePaths(options);
  pipeline = new core.PipelineBuilder().buildFromConfiguration(options);

  // Logging of errors and other messages.
  // Valid logs types are info, debug, warn, error
  pipeline.on('error', console.error);

  return pipeline;
};

// Directory holding the shared pattern-library assets (CSS and JS) that
// are served at '/css/...' and '/js/...'.
const publicDir = path.join(__dirname, '/public');

const server = http.createServer((req, res) => {
  // Serve the shared example assets before running the pipeline. When the
  // request is for one of those files the response is sent here and we
  // return early.
  if (ExampleUtils.serveStaticAsset(req, res, publicDir)) {
    return;
  }

  // FlowData is a data structure that is used to convey
  // information required for detection and the results of the
  // detection through the pipeline.
  // Information required for detection is called "evidence".
  // The User-Agent and IP address of the requesting client are
  // added automatically from the request.
  const flowData = pipeline.createFlowData();

  // Extract required evidence from the Http request.
  flowData.evidence.addFromRequest(req);

  flowData.process().then(function () {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');

    // Obtain all used evidence
    const allEvidence = flowData.evidence.getAll();
    const deviceEvidence =
      pipeline.getElement('device').evidenceKeyFilter.filterEvidence(
        allEvidence);
    const ipEvidence =
      pipeline.getElement('ip').evidenceKeyFilter.filterEvidence(
        allEvidence);
    const evidenceUsed = Object.assign({}, deviceEvidence, ipEvidence);

    // The IP address supplied through the lookup form, used to
    // pre-populate the input on the rendered page.
    const inputIpAddress =
      (allEvidence['query.client-ip'] ||
        allEvidence['header.x-forwarded-for'] || '');

    // A property that the data file does not have is shown as needing the
    // Enterprise data file.
    const deviceEngine = pipeline.getElement('device');
    const ipEngine = pipeline.getElement('ip');
    const areas = ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'areas');
    const latitude = ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'latitude');
    const longitude = ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'longitude');
    const located = (value) => value === NEEDS_ENTERPRISE ? '' : value;

    // Compile a response
    res.end(compiledFunction(
      {
        dataFileOld: ExampleUtils.isDataFileOld(pipeline),
        dataFileAgeWarning: DATA_FILE_AGE_WARNING,
        evidenceUsed,
        allEvidence,
        inputIpAddress,
        areas,
        mapAreas: located(areas),
        freeDataFile: ExampleUtils.isFreeDataFile(ipEngine),
        isMobile: ExampleUtils.getEnterpriseValue(deviceEngine, flowData.device, 'ismobile'),
        platformName: ExampleUtils.getEnterpriseValue(deviceEngine, flowData.device, 'platformname'),
        platformVersion: ExampleUtils.getEnterpriseValue(deviceEngine, flowData.device, 'platformversion'),
        browserName: ExampleUtils.getEnterpriseValue(deviceEngine, flowData.device, 'browsername'),
        browserVersion: ExampleUtils.getEnterpriseValue(deviceEngine, flowData.device, 'browserversion'),
        deviceType: ExampleUtils.getEnterpriseValue(deviceEngine, flowData.device, 'devicetype'),
        registeredName: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'registeredname'),
        registeredOwner: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'registeredowner'),
        registeredCountry: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'registeredcountry'),
        ipRangeStart: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'iprangestart'),
        ipRangeEnd: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'iprangeend'),
        country: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'country'),
        countryCode: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'countrycode'),
        town: ExampleUtils.getEnterpriseValue(ipEngine, flowData.ip, 'town'),
        latitude,
        longitude,
        mapLatitude: located(latitude),
        mapLongitude: located(longitude)
      })
    );
  });
});

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  // Load the configuration options from config file.
  const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')));

  setPipeline(options);
  const port = 3001;
  const hostname = 'localhost';
  server.listen(port, hostname);
  console.log(`Server listening on: http://${hostname}:${port}`);
};

// Export server object and set pipeline.
module.exports = {
  server,
  setPipeline
};
