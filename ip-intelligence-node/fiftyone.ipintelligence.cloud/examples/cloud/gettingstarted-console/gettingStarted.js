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
 * @example cloud/gettingstarted-console/gettingStarted.js
 * This example is available in full on [GitHub](https://github.com/51Degrees/ip-intelligence-node/blob/master/fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-console/gettingStarted.js).
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
    return require(requestedPackage);
  }
};

const fs = require('fs');

const PipelineBuilder = require51('fiftyone.pipeline.core').PipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils'));
const exampleConstants = require51('fiftyone.ipintelligence.shared').exampleConstants;
const OptionsExtension = require51('fiftyone.ipintelligence.shared').optionsExtension;
const DataExtension = require51('fiftyone.ipintelligence.shared').dataExtension;

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

  // Track whether any property is left without a value, which is
  // usually because the resource key does not include the property.
  let anyValueMissing = false;
  const getValue = function (propertyName) {
    try {
      const property = ip[propertyName];
      if (!property || property.hasValue !== true) {
        anyValueMissing = true;
      }
    } catch (e) {
      anyValueMissing = true;
    }
    return DataExtension.getValueHelper(ip, propertyName);
  };

  // Display the results of the lookup, which are called
  // IP intelligence properties. See the property dictionary at
  // https://51degrees.com/developers/property-dictionary?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-gettingstarted-console-gettingstarted.js&utm_term=analyse
  // for details of all available properties.
  message += outputValue('Registered Name', getValue('registeredname'));
  message += outputValue('Registered Owner', getValue('registeredowner'));
  message += outputValue('Registered Country', getValue('registeredcountry'));
  message += outputValue('IP Range Start', getValue('iprangestart'));
  message += outputValue('IP Range End', getValue('iprangeend'));
  message += outputValue('Country', getValue('country'));
  message += outputValue('Country Code', getValue('countrycode'));
  message += outputValue('Town', getValue('town'));
  message += outputValue('Latitude', getValue('latitude'));
  message += outputValue('Longitude', getValue('longitude'));
  message += '\n\n';
  output.write(message);
  return anyValueMissing;
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
      'https://51degrees.com/documentation/_info__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-gettingstarted-console-gettingstarted.js&utm_term=resource-key-required. ' +
      'A resource key with everything this example displays can be ' +
      'created at https://configure.51degrees.com/hYzn3TV3?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-gettingstarted-console-gettingstarted.js&utm_term=resource-key-required with a paid ' +
      'subscription. A free key created at ' +
      'https://configure.51degrees.com/Wkqxf3Bs?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-gettingstarted-console-gettingstarted.js&utm_term=resource-key-required populates only the ' +
      'Country, LocationConfidence, Ip and IpV6 properties. See ' +
      'https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-gettingstarted-console-gettingstarted.js&utm_term=resource-key-required to get a paid subscription with ' +
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

  // carry out some sample lookups
  let anyValueMissing = false;
  for (const values of exampleConstants.defaultEvidenceValues) {
    if (await analyse(values, pipeline, output)) {
      anyValueMissing = true;
    }
  }

  // If any property was left without a value then show the common
  // pricing message once after the results.
  if (anyValueMissing) {
    output.write(ExampleUtils.PRICING_MESSAGE + '\n');
  }
};

// Don't run the server if under TEST
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
