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
 * @example onpremise/mixed/gettingstarted-console/gettingStarted.js
 *
 * This example demonstrates using both device detection and IP
 * intelligence engines in a single pipeline. Both engines process the
 * evidence and their results are available from the same flow data.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-console/gettingStarted.js).
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
      return require(requestedPackage);
    } catch (e2) {
      return require(requestedPackage);
    }
  }
};

const core = require51('fiftyone.pipeline.core');

const DeviceDetectionOnPremise =
  require51('fiftyone.devicedetection.onpremise').DeviceDetectionOnPremise;

const IpIntelligenceOnPremise =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremise;

const { ExampleUtils, NEEDS_ENTERPRISE } =
  require(path.join(__dirname, '/../../exampleUtils'));

// The free Lite data files, which are downloaded if they are missing.
const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

// Where to ask for a copy of the Enterprise data files, tagged with this
// example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-mixed-gettingstarted-console-gettingstarted.js&utm_term=enterprise-data-file';

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

// A property that the data file does not have is shown as needing the
// Enterprise data file.
const outputValue = function (name, elementData, propertyName) {
  return `\n\t${name}: ` + ExampleUtils.getEnterpriseValue(
    elementData.flowElement, elementData, propertyName);
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

  // Process the flow data - both engines will run.
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
  const needsEnterprise = message.includes(NEEDS_ENTERPRISE);

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
  return needsEnterprise || message.includes(NEEDS_ENTERPRISE);
};

const run = async function (deviceDataFile, ipDataFile, output) {
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

  // Create a pipeline and add both engines to it. For more information
  // about pipelines in general see the documentation at
  // https://51degrees.com/documentation/_pipeline_api__concepts__configuration__builders__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-mixed-gettingstarted-console-gettingstarted.js&utm_term=run
  const pipeline = new core.PipelineBuilder()
    .add(deviceEngine)
    .add(ipEngine)
    .build();

  // To monitor the pipeline we can put in listeners for various log
  // events. Valid types are info, debug, warn, error.
  pipeline.on('error', console.error);

  // Process the combined evidence (User-Agent for device detection,
  // IP address for IP intelligence).
  let needsEnterprise = false;
  for (const evidence of combinedEvidence) {
    needsEnterprise = await analyse(evidence, pipeline, output) || needsEnterprise;
  }
  if (needsEnterprise) {
    output.write(`${ExampleUtils.getEnterpriseNote(CONTACT_US)}\n`);
  }

  // Check the IP intelligence data file.
  ExampleUtils.checkDataFile(pipeline, ipDataFile);
};

// Don't run the example if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);

  // Use the supplied path for the device detection data file, the path in
  // the _51DEGREES_DD_PATH environment variable, or the Lite file.
  const deviceDataFile = args.length > 0
    ? args[0]
    : ExampleUtils.findDeviceDataFile(LITE_V_4_1_HASH);

  // Use the supplied path for the IP intelligence data file, the path in
  // the _51DEGREES_IPI_PATH environment variable, or the Lite file.
  const ipDataFile = args.length > 1
    ? args[1]
    : ExampleUtils.findDataFile(LITE_V_4_1_IPI);

  if (deviceDataFile !== undefined && ipDataFile !== undefined) {
    console.log(`Device detection data file: ${deviceDataFile}`);
    console.log(`IP intelligence data file: ${ipDataFile}`);
    run(deviceDataFile, ipDataFile, process.stdout);
  } else {
    if (deviceDataFile === undefined) {
      console.error('Failed to find a device detection data file. ' +
        'Make sure the cxx/data submodule has been fetched by running ' +
        '`git submodule update --init --recursive`. The full path to a ' +
        'data file can be specified as the first command line argument');
    }
    if (ipDataFile === undefined) {
      console.error('Failed to find an IP intelligence data file. ' +
        'Make sure the cxx/data submodule has been fetched by running ' +
        '`git submodule update --init --recursive`. The full path ' +
        'to a data file can be specified as the second command line ' +
        'argument');
    }
  }
};

module.exports = {
  run
};
