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
 * @example cloud/metadata-console/metaData.js
 *
 * The cloud service exposes meta data that can provide additional information about the
 * various properties that might be returned.
 * This example shows how to access this data and display the values available.
 *
 * A list of the properties will be displayed, along with some additional information about each
 * property. Note that this is the list of properties used by the supplied resource key, rather
 * than all properties that can be returned by the cloud service.
 *
 * Finally, the evidence keys that are accepted by IP intelligence are listed. These are the
 * keys that, when added to the evidence collection in flow data, could have some impact on the
 * result that is returned.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.cloud/examples/cloud/metadata-console/metaData.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.cloudrequestengine](https://www.npmjs.com/package/fiftyone.pipeline.cloudrequestengine)
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.ipintelligence.cloud](https://www.npmjs.com/package/fiftyone.ipintelligence.cloud)
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

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils'));

// Where to go next, printed at every end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/ip-intelligence',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tIP Intelligence documentation: https://51degrees.com/documentation/_ip_intelligence__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=find-out-more-documentation',
  '\tResource keys: https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=find-out-more-resource-keys',
  '\tPricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=find-out-more-contact'
].join('\n');

const IpIntelligenceCloudPipelineBuilder = require51('fiftyone.ipintelligence.cloud').IpIntelligenceCloudPipelineBuilder;

const outputProperties = function (engine, output) {
  for (let property in engine.properties) {
    property = engine.properties[property];
    output.write(`Property - ${property.name}`);
    output.write(`[Category: ${property.category}] (${property.type})\n`);
  }
};

const outputEvidenceKeyDetails = function (engine, output) {
  output.write('\n');
  output.write('Accepted evidence keys:\n');
  for (const evidence of engine.evidenceKeyFilter.list) {
    output.write(`\t${evidence}\n`);
  }
};

const run = async function (resourceKey, output) {
  const pipeline = new IpIntelligenceCloudPipelineBuilder({
    resourceKey
  }).build();

  // Without a listener, a dropped connection crashes the process instead of
  // rejecting ready().
  pipeline.on('error', console.error);

  const ip = pipeline.getElement('ip');
  // The promise is returned so that run() does not resolve before the
  // properties have been written. Without the return, a failure here
  // becomes an unhandled rejection that the caller never sees.
  return ip.ready().then(function () {
    outputProperties(ip, output);
    // We use the CloudRequestEngine to get evidence key details, rather than the
    // IpIntelligenceCloud.
    // This is because the IpIntelligenceCloud doesn't actually make use
    // of any evidence values. It simply processes the JSON that is returned
    // by the call to the cloud service that is made by the CloudRequestEngine.
    // The CloudRequestEngine is actually taking the evidence values and passing
    // them to the cloud, so that's the engine we want the keys from.
    outputEvidenceKeyDetails(pipeline.getElement('cloud'), output);
  }).catch(function (error) {
    throw error;
  });
};

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied resource key or try to obtain one
  // from the environment variables.
  const resourceKey = args.length > 0 ? args[0] : ExampleUtils.getResourceKeyFromEnv();

  if (resourceKey) {
    run(resourceKey, process.stdout).then(() => console.log(FIND_OUT_MORE));
  } else {
    console.error('No resource key specified on the command line or in the ' +
    `the environment variable '${ExampleUtils.RESOURCE_KEY_VARIABLE}'. ` +
    'The 51Degrees cloud service is accessed using a \'ResourceKey\'. ' +
    'For more information ' +
    'see https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=resource-key-required. ' +
    'A resource key with everything this example displays can be ' +
    'created at https://configure.51degrees.com/hYzn3TV3?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=resource-key-required with a paid ' +
    'subscription. A free key created at ' +
    'https://configure.51degrees.com/Wkqxf3Bs?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=resource-key-required populates only the ' +
    'Country, LocationConfidence, Ip and IpV6 properties. See ' +
    'https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.cloud-examples-cloud-metadata-console-metadata.js&utm_term=resource-key-required to get a paid subscription with ' +
    'more properties. You can now populate the environment variable ' +
    'mentioned at the start of this message with the resource key or ' +
    'pass it as the first argument on the command line.');
    console.log(FIND_OUT_MORE);
  }
};

module.exports = {
  run
};
