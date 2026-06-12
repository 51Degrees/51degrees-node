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
 * @example cloud/gettingstarted-web/gettingStarted.js
 *
 * This example demonstrates how to use the 51Degrees cloud IP intelligence
 * service as part of a simple web server. The IP address of the requesting
 * client is used as evidence and details about the associated network, and
 * location are displayed.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-web/gettingStarted.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.cloudrequestengine](https://www.npmjs.com/package/fiftyone.pipeline.cloudrequestengine)
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.cloud](https://www.npmjs.com/package/fiftyone.ipintelligence.cloud)
 * - [pug](https://www.npmjs.com/package/pug)
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

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils'));

// Pipeline variable to be used
let pipeline;

const setPipeline = (options) => {
  const resourceKey = optionsExtension.getResourceKey(options);

  if (!resourceKey || resourceKey.startsWith('!!')) {
    throw 'No resource key specified in the configuration file ' +
      '\'51d.json\' or the environment variable ' +
      `'${ExampleUtils.RESOURCE_KEY_ENV_VAR}'. The 51Degrees cloud ` +
      'service is accessed using a \'ResourceKey\'. For more information ' +
      'see ' +
      'https://51degrees.com/documentation/_info__resource_keys.html. ' +
      'A resource key with the properties required by this example can be ' +
      'created for free at https://configure.51degrees.com/1QWJwHxl. ' +
      'Once complete, populate the config file or environment variable ' +
      'mentioned at the start of this message with the key.';
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
      pipeline.getElement('cloud').evidenceKeyFilter.filterEvidence(
        allEvidence);

    // Compile a response
    res.end(compiledFunction(
      {
        evidenceUsed: evidences,
        allEvidence,
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

  // Use the resource key from the environment variables if one
  // is not present in the configuration.
  const resourceKeyFromConfig = optionsExtension.getResourceKey(options);
  if (!resourceKeyFromConfig || resourceKeyFromConfig.startsWith('!!')) {
    optionsExtension.setResourceKey(
      options, ExampleUtils.getResourceKeyFromEnv());
  }

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
