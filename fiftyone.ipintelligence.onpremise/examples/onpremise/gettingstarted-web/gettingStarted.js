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
 * @example onpremise/gettingstarted-web/gettingStarted.js
 *
 * This example demonstrates how to use the 51Degrees on-premise IP
 * intelligence engine as part of a simple web server. The IP address of the
 * requesting client is used as evidence and details about the associated
 * network, and location are displayed.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-web/gettingStarted.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 * - [pug](https://www.npmjs.com/package/pug)
 *
 * This example can be configured using the 51d.json file. The path to the
 * data file is taken from this configuration, and can be changed by editing
 * the file.
 *
 * The results of the lookup can be accessed by querying the `ip` property of
 * a FlowData object. This can then be used to interrogate the data.
 * ```
 * var flowData = pipeline.createFlowData();
 * flowData.evidence.addFromRequest(request);
 * await flowData.process();
 * var ipData = flowData.ip;
 * var registeredName = ipData.registeredname;
 * ```
 *
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(path.join(__dirname, '/../../../../', requestedPackage));
  }
};

const fs = require('fs');
const http = require('http');
const pug = require('pug');

const compiledFunction =
  pug.compileFile(path.join(__dirname, '/index.pug'));

const core = require51('fiftyone.pipeline.core');

const optionsExtension =
  require51('fiftyone.ipintelligence.shared').optionsExtension;

const dataExtension =
  require51('fiftyone.ipintelligence.shared').dataExtension;

const { DATA_FILE_AGE_WARNING, ExampleUtils } =
  require(path.join(__dirname, '/../exampleUtils'));

// Pipeline variable to be used
let pipeline;

const setPipeline = (options) => {
  const dataFilePath = optionsExtension.getDataFilePath(options);
  if (!dataFilePath) {
    throw 'A data file must be specified in the 51d.json file.';
  }

  if (!fs.existsSync(dataFilePath)) {
    const newDataFilePath = ExampleUtils.findFile(path.basename(dataFilePath));
    if (newDataFilePath !== undefined) {
      optionsExtension.setDataFilePath(options, newDataFilePath);
      console.warn('Failed to find an IP intelligence data file ' +
        `at the specified path '${dataFilePath}'. Use '${newDataFilePath}' ` +
        'instead.');
    } else {
      throw 'Failed to find an IP intelligence data file at ' +
        `'${dataFilePath}'. If using the lite file, then make sure the ` +
        'ip-intelligence-data submodule has been updated by running ' +
        '\'git submodule update --recursive\'. Otherwise, ensure that the ' +
        'filename is correct in 51d.json.';
    }
  }

  pipeline = new core.PipelineBuilder().buildFromConfiguration(options);

  // Logging of errors and other messages.
  // Valid logs types are info, debug, warn, error
  pipeline.on('error', console.error);
};

const server = http.createServer((req, res) => {
  // FlowData is a data structure that is used to convey
  // information required for detection and the results of the
  // detection through the pipeline.
  // Information required for detection is called "evidence".
  // For IP intelligence the IP address of the requesting client
  // is used. This is added automatically from the request.
  const flowData = pipeline.createFlowData();

  // Extract required evidence from the Http request.
  flowData.evidence.addFromRequest(req);

  flowData.process().then(function () {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'text/html');

    // Obtain all used evidence
    const allEvidence = flowData.evidence.getAll();
    const evidences =
      pipeline.getElement('ip').evidenceKeyFilter.filterEvidence(
        allEvidence);

    // Compile a response
    res.end(compiledFunction(
      {
        dataFilePublishedTime: new Date().getTime(),
        dataFileAgeWarning: DATA_FILE_AGE_WARNING,
        evidenceUsed: evidences,
        allEvidence,
        dataSourceTier: ExampleUtils.getDataTier(pipeline),
        registeredName: dataExtension.getValueHelper(flowData.ip, 'registeredname'),
        registeredOwner: dataExtension.getValueHelper(flowData.ip, 'registeredowner'),
        registeredCountry: dataExtension.getValueHelper(flowData.ip, 'registeredcountry'),
        ipRangeStart: dataExtension.getValueHelper(flowData.ip, 'iprangestart'),
        ipRangeEnd: dataExtension.getValueHelper(flowData.ip, 'iprangeend'),
        country: dataExtension.getValueHelper(flowData.ip, 'country'),
        countryCode: dataExtension.getValueHelper(flowData.ip, 'countrycode'),
        town: dataExtension.getValueHelper(flowData.ip, 'town'),
        latitude: dataExtension.getValueHelper(flowData.ip, 'latitude'),
        longitude: dataExtension.getValueHelper(flowData.ip, 'longitude')
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
