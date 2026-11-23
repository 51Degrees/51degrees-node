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
 * @example cloud/nativemodellookup-console/nativeModelLookup.js
 *
 * This example shows how to use the 51Degrees Cloud service to lookup the details of a device
 * based on a given 'native model name'. Native model name is a string of characters that are
 * returned from a query to the device's OS.
 * There are different mechanisms to get native model names for
 * [Android devices](https://developer.android.com/reference/android/os/Build#MODEL) and
 * [iOS devices](https://gist.github.com/soapyigu/c99e1f45553070726f14c1bb0a54053b#file-machinename-swift)
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/device-detection/fiftyone.devicedetection.cloud/examples/cloud/nativemodellookup-console/nativeModelLookup.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.cloudrequestengine](https://www.npmjs.com/package/fiftyone.pipeline.cloudrequestengine)
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.devicedetection.cloud](https://www.npmjs.com/package/fiftyone.devicedetection.cloud)
 *
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

// Require the core Pipeline and Cloud Request Engine
const pipelineCore = require51('fiftyone.pipeline.core');
const CloudRequestEngine = require51('fiftyone.pipeline.cloudrequestengine');
// Note that this example is designed to be run from within the
// device detection code base. If this code has been copied to run
// standalone then you'll need to replace the require below with the
// commented out version below it.
const HardwareProfileCloudEngine = require51('fiftyone.devicedetection.cloud').HardwareProfileCloudEngine;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils'));

const constants = require(path.join(__dirname, '/../../../constants.js'));

const DataExtension = require51('fiftyone.devicedetection.shared').dataExtension;

// Where to go next, printed at every end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/device-detection',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tDevice detection documentation: https://51degrees.com/documentation/_device_detection__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=find-out-more-documentation',
  '\tResource keys: https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=find-out-more-resource-keys',
  '\tPricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=find-out-more-contact'
].join('\n');

// Printed in place of the lookups when the resource key does not carry the
// hardware lookup.
const NO_HARDWARE_LOOKUP =
  'The resource key does not include HardwarePlatform.Profiles, the ' +
  'hardware lookup this example needs, so no devices are listed. Create a ' +
  'resource key that includes it at ' +
  'https://51degrees.com/configure/QKyYH5XT?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=no-hardware-lookup, ' +
  'or contact us about it at ' +
  'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=no-hardware-lookup.';

// Whether the resource key carries the hardware lookup. The hardware
// engine's properties come from the cloud service's list of the properties
// the key can access, so this is known before any lookup is made. The first
// wait can share the request made as the engine was built, so when it fails
// the cloud request engine is asked once more before anything is decided. A
// second failure is the cloud service's error, and is thrown.
const hasHardwareLookup = async function (hardwareEngine) {
  try {
    await hardwareEngine.ready();
  } catch (errors) {
    await hardwareEngine.ready();
  }
  const properties = hardwareEngine.properties;
  return properties !== undefined && properties !== null &&
    properties.profiles !== undefined;
};

// The errors that stopped the example, which arrive as a list, as lists
// within a list, or as an error that holds a list.
const errorsIn = function (reason) {
  if (Array.isArray(reason)) {
    return [].concat(...reason.map(errorsIn));
  }
  if (reason !== null && typeof reason === 'object' &&
    Array.isArray(reason.errors)) {
    return errorsIn(reason.errors);
  }
  return [reason];
};

// Whether an error came from a request to the cloud service, which the cloud
// request engine names CloudRequestError.
const isCloudRequestError = function (error) {
  return error instanceof Error && error.name === 'CloudRequestError';
};

// The text of an error, with the status code the cloud service answered with
// when the text does not already give one.
const messageOf = function (error) {
  if (!(error instanceof Error)) {
    return String(error);
  }
  const status = error.httpStatusCode;
  return typeof status === 'number' && !/status code/i.test(error.message)
    ? `${error.message} (status code ${status})`
    : error.message;
};

// Ends the example with the error that stopped it and an exit code that
// says it failed. Errors from requests to the cloud service are described
// as a failed request by their messages alone. Any other error is a fault
// the example did not expect, so its stack trace follows the message.
const endWithError = function (reason) {
  const errors = errorsIn(reason);
  const messages = errors.map(messageOf).join(' ');
  if (errors.length > 0 && errors.every(isCloudRequestError)) {
    console.error('The example stopped because the request to the cloud ' +
      `service failed. ${messages}`);
  } else {
    console.error(`The example stopped: ${messages}`);
    for (const error of errors) {
      if (error instanceof Error && error.stack) {
        console.error(error.stack);
      }
    }
  }
  console.log(FIND_OUT_MORE);
  process.exitCode = 1;
};

const analyseNativeModel = async function (nativemodel, pipeline, output) {
  // Create a flow data instance.
  const flowData = pipeline.createFlowData();

  // After creating a flowdata instance, add the native model name as evidence.
  flowData.evidence.add(constants.EVIDENCE_QUERY_NATIVE_MODEL_KEY, nativemodel);

  await flowData.process();
  output.write('Which devices are associated with the native model name ' +
  `'${nativemodel}'?\n`);

  // The result is an array containing the details of any devices that match
  // the specified native model name.
  // The code in this example iterates through this array, outputting the
  // vendor and model of each matching device.
  const profiles = DataExtension.getProfilesHelper(flowData.hardware);

  if (profiles.length === 0) {
    output.write('\tNo devices are associated with this native model name.\n');
    return;
  }

  profiles.forEach(profile => {
    const hardwareVendor = DataExtension.getValueHelper(profile, 'hardwarevendor');
    const hardwareName = DataExtension.getValueHelper(profile, 'hardwarename');
    const hardwareModel = DataExtension.getValueHelper(profile, 'hardwaremodel');

    output.write(`\t${hardwareVendor} ${hardwareName} (${hardwareModel})\n`);
  });
};

const run = async function (resourceKey, output) {
  output.write('This example finds the details of devices from the ' +
    '\'native model name\'.\n');
  output.write('The native model name can be retrieved by code running ' +
    'on the device (For example, a mobile app).\n');
  output.write('For Android devices, see ' +
    'https://developer.android.com/reference/android/os/Build#MODEL\n');
  output.write('For iOS devices, see ' +
    'https://gist.github.com/soapyigu/c99e1f45553070726f14c1bb0a54053b#file-machinename-swift\n');
  output.write('----------------------------------------\n');

  // This example creates the pipeline and engines in code. For a demonstration
  // of how to do this using a configuration file instead, see the TacLookup example.
  // For more information about builders in general see the documentation at
  // https://51degrees.com/documentation/_pipeline_api__concepts__configuration__builders__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=run
  const requestEngineInstance = new CloudRequestEngine.CloudRequestEngine({
    resourceKey
  });

  // Create the hardware profile engine to process the response from the
  // request engine.
  const hardwareProfileCloudEngineInstance = new HardwareProfileCloudEngine();

  // Create the pipeline using the engines.
  const PipelineBuilder = pipelineCore.PipelineBuilder;
  const pipeline = new PipelineBuilder()
    .add(requestEngineInstance)
    .add(hardwareProfileCloudEngineInstance)
    .build();

  // Logging of errors and other messages. Valid logs types are info, debug,
  // warn, error
  pipeline.on('error', console.error);

  if (!await hasHardwareLookup(hardwareProfileCloudEngineInstance)) {
    output.write(NO_HARDWARE_LOOKUP + '\n');
    return;
  }

  const nativeModelAndroid = 'SC-03L';
  const nativeModeliOS = 'iPhone11,8';

  await analyseNativeModel(nativeModelAndroid, pipeline, output);
  await analyseNativeModel(nativeModeliOS, pipeline, output);
};

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied resource key or try to obtain one
  // from the environment variables.
  const resourceKey = args.length > 0 ? args[0] : ExampleUtils.getResourceKeyFromEnv();

  if (resourceKey) {
    run(resourceKey, process.stdout)
      .then(() => console.log(FIND_OUT_MORE))
      .catch(endWithError);
  } else {
    console.error('No resource key specified on the command line or in the ' +
    `the environment variable '${ExampleUtils.RESOURCE_KEY_ENV_VAR}'. ` +
    'The 51Degrees cloud service is accessed using a \'ResourceKey\'. ' +
    'For more information ' +
    'see https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=resource-key-required. ' +
    'Native model lookup requires a paid subscription. See ' +
    'https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=resource-key-required to get a paid subscription with more ' +
    'properties. Once subscribed, a resource key with the properties ' +
    'required by this example can be created at ' +
    'https://51degrees.com/configure/QKyYH5XT?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.cloud-examples-cloud-nativemodellookup-console-nativemodellookup.js&utm_term=resource-key-required. You can now populate the ' +
    'environment variable mentioned at the start of this message with the ' +
    'resource key or pass it as the first argument on the command line.');
    console.log(FIND_OUT_MORE);
  }
};

module.exports = {
  run
};
