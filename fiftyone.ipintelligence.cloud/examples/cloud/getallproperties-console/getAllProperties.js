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
 * @example cloud/getallproperties-console/getAllProperties.js
 *
 * This example shows how to retrieve all available IP intelligence
 * properties from the 51Degrees cloud service.
 *
 * You will learn:
 *
 * 1. How to create a pipeline that uses the 51Degrees cloud IP
 * intelligence service
 * 2. How to process an IP address and retrieve all available properties
 * 3. How to enumerate through all the properties returned by the service
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.cloud/examples/cloud/getallproperties-console/getAllProperties.js).
 *
 * To run this example, you will eventually need to create a resource key.
 * A resource key is used as shorthand to store the particular set of
 * properties you are interested in as well as any associated license keys
 * that entitle you to increased request limits and/or paid-for properties,
 * but it is not yet available for IP intelligence. For now, you can run
 * the onpremise/mixed/gettingstarted-api example to simulate a custom
 * hosted cloud service, and point this example to it by setting the
 * 'FOD_CLOUD_API_URL' environment variable to 'http://localhost:5225/'.
 * Any value can then be used for the resource key.
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.cloudrequestengine](https://www.npmjs.com/package/fiftyone.pipeline.cloudrequestengine)
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.cloud](https://www.npmjs.com/package/fiftyone.ipintelligence.cloud)
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

const PipelineBuilder = require51('fiftyone.pipeline.core').PipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils'));
const OptionsExtension = require51('fiftyone.ipintelligence.shared').optionsExtension;
const DataExtension = require51('fiftyone.ipintelligence.shared').dataExtension;

const SOME_IP_ADDRESS = '8.8.8.8';

// Convert the given value into a human-readable string representation.
// Long strings are truncated to 200 characters.
const getValueToOutput = function (ip, propertyName) {
  let value = DataExtension.getValueHelper(ip, propertyName);
  if (value !== undefined && value !== null && value.length > 200) {
    value = value.substring(0, 200) + '...';
  }
  return value;
};

const analyse = async function (ipAddress, pipeline, output) {
  // Create the FlowData instance.
  const data = pipeline.createFlowData();

  // Add the client IP as evidence.
  data.evidence.add('query.client-ip', ipAddress);

  // Process the supplied evidence.
  await data.process();

  // Get the IP data from the flow data.
  const ip = data.ip;
  output.write('What property values are associated with ' +
    `the IP '${ipAddress}'?\n`);

  // Iterate through the IP data results, displaying all values.
  for (const propertyName of Object.keys(ip.contents).sort()) {
    output.write(
      `${propertyName} = ${getValueToOutput(ip, propertyName)}\n`);
  }
};

const run = async function (options, output) {
  const resourceKey = OptionsExtension.getResourceKey(options);
  // If we don't have a resource key then log an error
  if (!resourceKey) {
    console.log(
      'No resource key specified in the configuration file ' +
      '\'51d.json\' or the environment variable ' +
      `'${ExampleUtils.RESOURCE_KEY_ENV_VAR}'. The 51Degrees cloud ` +
      'service is accessed using a \'ResourceKey\'. For more information ' +
      'see ' +
      'https://51degrees.com/documentation/_info__resource_keys.html. ' +
      'A resource key with everything this example displays can be ' +
      'created at https://configure.51degrees.com/hYzn3TV3 with a paid ' +
      'subscription. A free key created at ' +
      'https://configure.51degrees.com/Wkqxf3Bs populates only the ' +
      'Country, LocationConfidence, Ip and IpV6 properties. See ' +
      'https://51degrees.com/pricing to get a paid subscription with ' +
      'more properties. Once complete, populate the config file or ' +
      'environment variable mentioned at the start of this message ' +
      'with the key.'
    );
    return;
  }

  const pipeline = new PipelineBuilder().buildFromConfiguration(options);

  // To monitor the pipeline we can put in listeners for various log events.
  // Valid types are info, debug, warn, error
  pipeline.on('error', console.error);

  // Output details for the IP address.
  await analyse(SOME_IP_ADDRESS, pipeline, output);
};

// Don't run the example if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied resource key or try to obtain one
  // from the environment variables.
  const resourceKey = args.length > 0 ? args[0] : ExampleUtils.getResourceKeyFromEnv();

  // Load the configuration from a config file to a JSON object.
  const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')), 'utf8');

  const resourceKeyFromConfig = OptionsExtension.getResourceKey(options);
  if (!resourceKeyFromConfig || resourceKeyFromConfig.startsWith('!!')) {
    OptionsExtension.setResourceKey(options, resourceKey);
  }

  run(options, process.stdout);
}

module.exports = {
  run
};
