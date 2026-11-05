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
 * @example onpremise/suspicious-console/suspicious.js
 *
 * This example shows how to combine 51Degrees on-premise IP intelligence
 * properties to determine whether an IP is likely to be the source of
 * suspicious requests.
 *
 * You will learn:
 *
 * 1. How to get diversity properties from the IP intelligence engine.
 * 2. How to combine diversity values with other network related values to
 * assess the likelihood of an IP address being something suspicious.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/suspicious-console/suspicious.js).
 *
 * This example requires an enterprise IP intelligence data file (.ipi).
 * To obtain an enterprise data file for testing, please
 * [contact us](https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-suspicious-console-suspicious.js&utm_term=header).
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
    return require(requestedPackage);
  }
};

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;
const exampleConstants = require51('fiftyone.ipintelligence.shared').exampleConstants;

// This example needs the diversity properties, which only the Enterprise
// data file has. By default it uses the free Lite data file, which is
// downloaded if it is missing, and there it says what it needs and where
// to ask for a copy of the Enterprise data file.
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

// Where to ask for a copy of the Enterprise data file, tagged with this
// example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-suspicious-console-suspicious.js&utm_term=enterprise-data-file';

// Most IP intelligence values are lists of weighted values. This helper
// returns the single value with the highest weight, or the supplied
// default where no value is available.
const getValue = ExampleUtils.getSingleValue;

const analyse = async function (evidence, pipeline, output) {
  // Process the evidence.
  const data = pipeline.createFlowData();
  evidence.forEach((value, key, map) => {
    data.evidence.add(key, value);
  });
  await data.process();
  const ip = data.ip;

  // In this example we use the following properties to make some
  // basic assumptions about the likelihood of an IP being a source of
  // suspicious activity.
  const isCellular = getValue(ip, 'iscellular', false) === true;
  const hardwareDiversity = Number(getValue(ip, 'hardwarediversity', 0));
  const browserDiversity = Number(getValue(ip, 'browserdiversity', 0));
  const locationConfidence = getValue(ip, 'locationconfidence', null);
  const hosted = getValue(ip, 'ishosted', false) === true;
  const country = getValue(ip, 'countrycode', null);
  const registeredCountry = getValue(ip, 'registeredcountry', null);
  const human = Number(getValue(ip, 'humanprobability', 0));

  // Calculating a simple "suspicious" score based on the properties
  // above.
  // Many other properties can be used to draw conclusions about the
  // likelihood of suspicious activity, and this is a basic example
  // that should not be used in production without further testing
  // and tuning.
  const isSuspicious =
    // Here we can say that if there is a high diversity of hardware
    // profiles in the IP, then it could be either VPN, cellular,
    // proxy, or other hosting.
    // We can then rule out cellular with the IsCellular property.
    // A low location confidence is further evidence of VPN or
    // proxy use, rather than other hosting, but this is not a
    // strong determiner on its own.
    (hardwareDiversity >= 7 &&
      isCellular === false &&
      locationConfidence === 'Low') ||
    // Then we can also consider the observed country, and the
    // country the IP range is registered to. If these are not the
    // same, then this can be an indication of VPN or proxy use.
    (hosted === true &&
      country !== null &&
      country !== 'Unknown' &&
      country !== registeredCountry) ||
    // If the browser versions are significantly more diverse than
    // the hardware, this may indicate that some devices are using
    // multiple browsers, which can be a sign of suspicious
    // activity.
    browserDiversity - hardwareDiversity > 2;

  let message = 'Input values:';
  for (const [key, value] of evidence) {
    message += `\n\t${key}: ${value}`;
  }
  message += '\nResults:';
  message += `\n\tIsCellular: ${isCellular}`;
  message += `\n\tHardwareDiversity: ${hardwareDiversity}`;
  message += `\n\tBrowserDiversity: ${browserDiversity}`;
  message += `\n\tLocationConfidence: ${locationConfidence}`;
  message += `\n\tIsHosted: ${hosted}`;
  message += `\n\tCountry: ${country}`;
  message += `\n\tRegisteredCountry: ${registeredCountry}`;
  message += `\n\tHumanProbability: ${human}`;
  message += `\n\tIsSuspicious: ${isSuspicious}`;
  output.write(message + '\n\n');
};

const run = async function (dataFile, output) {
  // In this example, we use the IpIntelligenceOnPremisePipelineBuilder
  // and configure it in code. For more information about
  // pipelines in general see the documentation at
  // https://51degrees.com/documentation/_pipeline_api__concepts__configuration__builders__index.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-suspicious-console-suspicious.js&utm_term=run
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    dataFile,
    // We use the max performance profile for optimal detection speed
    // in this example. See the documentation for more detail on this
    // and other configuration options:
    // https://51degrees.com/documentation/_pipeline_api__features__automatic_datafile_updates.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-suspicious-console-suspicious.js&utm_term=run
    // https://51degrees.com/documentation/_pipeline_api__features__usage_sharing.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-suspicious-console-suspicious.js&utm_term=run
    performanceProfile: 'MaxPerformance',
    // inhibit sharing usage for this example, usually this should be
    // set 'true'
    shareUsage: false,
    // inhibit auto-update of the data file for this test
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  }).build();

  // Telling whether an address is suspicious needs properties only the
  // Enterprise data file has, so with a free data file the example says so
  // and stops.
  if (ExampleUtils.lacksEnterpriseProperties(pipeline.getElement('ip'),
    'Telling whether an IP address is suspicious',
    ['IsCellular', 'HardwareDiversity', 'BrowserDiversity',
      'LocationConfidence', 'IsHosted', 'HumanProbability'],
    output, CONTACT_US)) {
    return;
  }

  // carry out some sample lookups
  for (const values of exampleConstants.defaultEvidenceValues) {
    await analyse(values, pipeline, output);
  }

  ExampleUtils.checkDataFile(pipeline, dataFile);
};

// Don't run the example if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file, the path in the
  // 51DEGREES_IPI_PATH environment variable, or find the lite file,
  // which is downloaded if it is missing.
  const dataFile = args.length > 0 ? args[0] : ExampleUtils.findDataFile(LITE_V_4_1_IPI);

  if (dataFile !== undefined) {
    run(dataFile, process.stdout);
  } else {
    console.error('Failed to find an IP intelligence ' +
      'data file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`. A different file can be ' +
      'specified by supplying the full path as a command line argument');
  }
};

module.exports = {
  run
};
