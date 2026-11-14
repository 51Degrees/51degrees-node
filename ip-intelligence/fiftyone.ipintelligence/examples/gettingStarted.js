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
 * @example gettingStarted.js
 *
 * This shows how to use IpIntelligencePipelineBuilder instead of specific
 * IpIntelligenceCloudPipelineBuilder.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence/examples/gettingStarted.js).
 *
 * Expected output:
 *
 * ```
 * Which country is the IP address '8.8.8.8' in?
 * United States
 * ```
 *
 */
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const IpIntelligencePipelineBuilder = require51('fiftyone.ipintelligence').IpIntelligencePipelineBuilder;

// Where to go next, printed at every end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/ip-intelligence',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tIP Intelligence documentation: https://51degrees.com/documentation/_ip_intelligence__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-examples-gettingstarted.js&utm_term=find-out-more-documentation',
  '\tResource keys: https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-examples-gettingstarted.js&utm_term=find-out-more-resource-keys',
  '\tPricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-examples-gettingstarted.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-examples-gettingstarted.js&utm_term=find-out-more-contact'
].join('\n');

// Create the IP intelligence pipeline with the desired settings.

// You need to create a resource key at
// https://configure.51degrees.com/Wkqxf3Bs?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-examples-gettingstarted.js&utm_term=myresourcekey and paste it into the code,
// replacing !!YOUR_RESOURCE_KEY!! below. The link selects the free
// properties, which include the country property used by this example.

// The resource key is read from the _51DEGREES_RESOURCE_KEY environment
// variable.
// 51DEGREES_RESOURCE_KEY and RESOURCE_KEY are the deprecated names of the
// same variable, read in that order only when _51DEGREES_RESOURCE_KEY is
// unset or empty.
const oldResourceKeyName = process.env['51DEGREES_RESOURCE_KEY']
  ? '51DEGREES_RESOURCE_KEY'
  : 'RESOURCE_KEY';
const oldResourceKey = process.env['51DEGREES_RESOURCE_KEY'] ||
  process.env.RESOURCE_KEY;
if (!process.env._51DEGREES_RESOURCE_KEY && oldResourceKey) {
  console.warn(`The ${oldResourceKeyName} environment variable is ` +
    'deprecated and _51DEGREES_RESOURCE_KEY replaces it. Set ' +
    '_51DEGREES_RESOURCE_KEY instead.');
}
const myResourceKey = process.env._51DEGREES_RESOURCE_KEY ||
  oldResourceKey || '!!YOUR_RESOURCE_KEY!!';

if (myResourceKey === '!!YOUR_RESOURCE_KEY!!') {
  console.log('You need to create a resource key at ' +
        'https://configure.51degrees.com/Wkqxf3Bs?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-examples-gettingstarted.js&utm_term=myresourcekey and paste it into ' +
        'the code, replacing !!YOUR_RESOURCE_KEY!!');
  console.log('Make sure to include the country property ' +
        'as it is used by this example.');
  console.log(FIND_OUT_MORE);
} else {
  // Construct the IP intelligence pipeline using the
  // IpIntelligencePipelineBuilder, passing in your resourceKey.
  // The build method completes the pipeline
  const pipeline = new IpIntelligencePipelineBuilder({
    resourceKey: myResourceKey
  }).build();

  // To monitor the pipeline we can put in listeners for various log events.
  // Valid types are info, debug, warn, error
  pipeline.on('error', console.error);

  // Here we make a function that gets an IP address as evidence and
  // uses the IP Intelligence Engine to determine the country it is in
  const checkCountry = async function (ipAddress) {
    // Create a FlowData element
    // This is used to add evidence and process it through the
    // FlowElements in the Pipeline.
    const flowData = pipeline.createFlowData();

    // Add the IP address as evidence
    flowData.evidence.add('query.client-ip', ipAddress);

    // Run process on the flowData (this returns a promise)
    await flowData.process();

    // Check the country property
    // this returns an AspectPropertyValue wrapper
    // letting you check if a value is set and if not why not
    const country = flowData.ip.country;

    console.log(`Which country is the IP address '${ipAddress}' in?`);

    // Check if the result has a meaningful value and output it
    if (country.hasValue) {
      console.log(country.value);
    } else {
      // Echo out why the value isn't meaningful
      console.log(country.noValueMessage);
    }
  };

  checkCountry('8.8.8.8').then(() => console.log(FIND_OUT_MORE));
}
