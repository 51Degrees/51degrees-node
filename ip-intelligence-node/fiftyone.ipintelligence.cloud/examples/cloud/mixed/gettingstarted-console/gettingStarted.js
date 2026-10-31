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
 * @example cloud/mixed/gettingstarted-console/gettingStarted.js
 *
 * This example demonstrates using both device detection and IP
 * intelligence from the 51Degrees cloud service.
 *
 * You will learn:
 *
 * 1. How to create a pipeline that uses both the 51Degrees cloud device
 * detection and IP intelligence services
 * 2. How to pass input data (User-Agent and IP address) to the pipeline
 * 3. How to retrieve device and IP intelligence results from a single
 * pipeline
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-console/gettingStarted.js).
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
 * - [fiftyone.devicedetection.cloud](https://www.npmjs.com/package/fiftyone.devicedetection.cloud)
 * - [fiftyone.ipintelligence.cloud](https://www.npmjs.com/package/fiftyone.ipintelligence.cloud)
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

const fs = require('fs');

const PipelineBuilder = require51('fiftyone.pipeline.core').PipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../../exampleUtils'));
const OptionsExtension = require51('fiftyone.ipintelligence.shared').optionsExtension;
const DataExtension = require51('fiftyone.ipintelligence.shared').dataExtension;

// Evidence that includes both a User-Agent (for device detection) and an
// IP address (for IP intelligence).
const combinedEvidence = [
  // Mobile device from China
  new Map([
    ['header.user-agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'],
    ['query.client-ip', '62.61.32.31']
  ]),
  // Desktop from Chile
  new Map([
    ['header.user-agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'],
    ['query.client-ip', '45.236.48.61']
  ]),
  // Tablet with IPv6
  new Map([
    ['header.user-agent', 'Mozilla/5.0 (iPad; CPU OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/91.0.4472.80 Mobile/15E148 Safari/604.1'],
    ['query.client-ip', '2001:0db8:085a:0000:0000:8a2e:0370:7334']
  ]),
  // Android device from USA
  new Map([
    ['header.user-agent', 'Mozilla/5.0 (Linux; Android 11; SM-G973F) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.120 Mobile Safari/537.36'],
    ['query.client-ip', '8.8.8.8']
  ])
];

const outputValue = function (name, elementData, propertyName) {
  return `\n\t${name}: ` +
    DataExtension.getValueHelper(elementData, propertyName);
};

const analyse = async function (evidence, pipeline, output) {
  // FlowData is used to convey information through the pipeline.
  const data = pipeline.createFlowData();

  // List the evidence.
  let message = '='.repeat(79);
  message += '\nInput values:';
  for (const [key, value] of evidence) {
    message += `\n\t${key}: ${value}`;
  }
  output.write(message + '\n');

  // Add the evidence values to the flow data.
  evidence.forEach((value, key, map) => {
    data.evidence.add(key, value);
  });

  // Process the flow data - both engines use the same cloud request.
  await data.process();

  // Get the device detection results.
  message = '\nDevice Detection Results:';
  message += '\n' + '-'.repeat(25);
  const device = data.device;
  message += outputValue('Mobile Device', device, 'ismobile');
  message += outputValue('Platform Name', device, 'platformname');
  message += outputValue('Platform Version', device, 'platformversion');
  message += outputValue('Browser Name', device, 'browsername');
  message += outputValue('Browser Version', device, 'browserversion');
  message += outputValue('Hardware Name', device, 'hardwarename');
  message += outputValue('Hardware Vendor', device, 'hardwarevendor');
  message += outputValue('Device Type', device, 'devicetype');
  message += outputValue('Screen Width', device, 'screenpixelswidth');
  message += outputValue('Screen Height', device, 'screenpixelsheight');
  output.write(message + '\n');

  // Get the IP intelligence results.
  message = '\nIP Intelligence Results:';
  message += '\n' + '-'.repeat(24);
  const ip = data.ip;
  message += outputValue('Country', ip, 'country');
  message += outputValue('Country Code', ip, 'countrycode');
  message += outputValue('Region', ip, 'region');
  message += outputValue('State', ip, 'state');
  message += outputValue('Town', ip, 'town');
  message += outputValue('Latitude', ip, 'latitude');
  message += outputValue('Longitude', ip, 'longitude');
  message += outputValue('Registered Name', ip, 'registeredname');
  message += outputValue('Registered Owner', ip, 'registeredowner');
  message += outputValue('Registered Country', ip, 'registeredcountry');
  message += outputValue('IP Range Start', ip, 'iprangestart');
  message += outputValue('IP Range End', ip, 'iprangeend');
  message += outputValue('Accuracy Radius', ip, 'accuracyradiusmin');
  message += outputValue('Time Zone Offset', ip, 'timezoneoffset');
  output.write(message + '\n\n');
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
      'https://51degrees.com/documentation/_info__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=ip-intelligence-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-mixed-gettingstarted-console-gettingstarted.js&utm_term=resource-key-required. ' +
      'A resource key with the properties required by this example can be ' +
      'created for free at https://configure.51degrees.com/1QWJwHxl?utm_source=code&utm_medium=example&utm_campaign=ip-intelligence-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-mixed-gettingstarted-console-gettingstarted.js&utm_term=resource-key-required. ' +
      'Once complete, populate the config file or environment variable ' +
      'mentioned at the start of this message with the key.'
    );
    return;
  }

  const pipeline = new PipelineBuilder().buildFromConfiguration(options);

  // To monitor the pipeline we can put in listeners for various log events.
  // Valid types are info, debug, warn, error
  pipeline.on('error', console.error);

  // carry out some sample lookups
  for (const values of combinedEvidence) {
    await analyse(values, pipeline, output);
  }
};

// Don't run the example if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied resource key or try to obtain one
  // from the environment variable.
  const resourceKey = args.length > 0 ? args[0] : process.env[ExampleUtils.RESOURCE_KEY_ENV_VAR];

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
