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
 * @example onpremise/gettingstarted-console/gettingStarted.js
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-console/gettingStarted.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(path.join(__dirname, '/../../../../', requestedPackage));
  }
};

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;
const DataExtension = require51('fiftyone.ipintelligence.shared').dataExtension;
const exampleConstants = require51('fiftyone.ipintelligence.shared').exampleConstants;

// In this example, by default, the 51degrees "Lite" file needs to be in the
// fiftyone.ipintelligence.onpremise/ip-intelligence-cxx/ip-intelligence-data,
// directory or you may specify another file as a command line parameter.
//
// Note that the Lite data file is only used for illustration, and has
// limited accuracy and capabilities.
// Find out about the Enterprise data file on our pricing page:
// https://51degrees.com/pricing
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

const outputValue = function (name, value) {
  // Individual result values have a wrapper called
  // `AspectPropertyValue`. This functions similarly to
  // a null-able type.
  // If the value has not been set then trying to access the
  // `value` property will throw an exception.
  // `AspectPropertyValue` also includes the `noValueMessage`
  // property, which describes why the value has not been set.
  return `\n\t${name}: ${value}`;
};

const analyse = async function (evidence, pipeline, output) {
  // FlowData is a data structure that is used to convey
  // information required for detection and the results of the
  // detection through the pipeline.
  // Information required for detection is called "evidence".
  // For IP intelligence this is usually a single IP address,
  // in this case represented by an Object with a single
  // key/value entry.

  // list the evidence
  let message = 'Input values:';
  for (const [key, value] of evidence) {
    message += `\n\t${key}: ${value}`;
  }
  output.write(message + '\n');

  const data = pipeline.createFlowData();

  // Add the evidence values to the flow data
  evidence.forEach((value, key, map) => {
    data.evidence.add(key, value);
  });

  await data.process();

  message = 'Results:';
  // Now that it's been processed, the flow data will have
  // been populated with the result. In this case, we want
  // information about the IP address, which we can get by
  // asking for the 'ip' data.
  const ip = data.ip;

  // Display the results of the lookup, which are called
  // IP intelligence properties. See the property dictionary at
  // https://51degrees.com/developers/property-dictionary
  // for details of all available properties.
  // Most IP intelligence values are lists of weighted values
  // where the weight indicates the proportion of the result
  // that the value applies to.
  message += outputValue('Registered Name', DataExtension.getValueHelper(ip, 'registeredname'));
  message += outputValue('Registered Owner', DataExtension.getValueHelper(ip, 'registeredowner'));
  message += outputValue('Registered Country', DataExtension.getValueHelper(ip, 'registeredcountry'));
  message += outputValue('IP Range Start', DataExtension.getValueHelper(ip, 'iprangestart'));
  message += outputValue('IP Range End', DataExtension.getValueHelper(ip, 'iprangeend'));
  message += outputValue('Country', DataExtension.getValueHelper(ip, 'country'));
  message += outputValue('Country Code', DataExtension.getValueHelper(ip, 'countrycode'));
  message += outputValue('Town', DataExtension.getValueHelper(ip, 'town'));
  message += outputValue('Latitude', DataExtension.getValueHelper(ip, 'latitude'));
  message += outputValue('Longitude', DataExtension.getValueHelper(ip, 'longitude'));
  message += '\n\n';
  output.write(message);
};

const run = async function (dataFile, output) {
  // In this example, we use the IpIntelligenceOnPremisePipelineBuilder
  // and configure it in code. For more information about
  // pipelines in general see the documentation at
  // https://51degrees.com/documentation/_concepts__configuration__builders__index.html
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    // We use the balanced profile as its performance is
    // sufficient for this example. See the documentation for
    // more detail on this and other configuration options:
    // https://51degrees.com/documentation/_features__automatic_datafile_updates.html
    // https://51degrees.com/documentation/_features__usage_sharing.html
    performanceProfile: 'Balanced',
    // inhibit sharing usage for this test, usually this
    // should be set 'true'
    shareUsage: false,
    // inhibit auto-update of the data file for this test
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();

  // carry out some sample lookups
  for (const values of exampleConstants.defaultEvidenceValues) {
    await analyse(values, pipeline, output);
  }

  ExampleUtils.checkDataFile(pipeline, dataFile);
};

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file, the path in the
  // 51DEGREES_IPI_PATH environment variable, or find the lite
  // file that is included in the repository.
  const dataFile = args.length > 0 ? args[0] : ExampleUtils.findDataFile(LITE_V_4_1_IPI);

  if (dataFile !== undefined) {
    run(dataFile, process.stdout);
  } else {
    console.error('Failed to find an IP intelligence ' +
      'data file. Make sure the ip-intelligence-data ' +
      'submodule has been updated by running ' +
      '`git submodule update --recursive`.');
  }
};

module.exports = {
  run
};
