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
@example configureFromFile.js

This example shows how to configure a pipeline with 51Degrees location
provider from a configuration file using the pipelineBuilder's
buildFromConfigurationFile method.

This example is available in full on [GitHub](https://github.com/51Degrees/location-node/blob/master/examples/configureFromFile.js).

To run this example, you will need to create a **resource key**.
The resource key is used as short-hand to store the particular set of
properties you are interested in as well as any associated license keys
that entitle you to increased request limits and/or paid-for properties.

You can create a resource key using the 51Degrees
[Configurator](https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-configurefromfile.js&utm_term=top).

Make sure to include the Country property, as it is required to run this
example.

The configuration file used here is:

@include 51d.json

Expected output:

```
Which country is the location [51.458048,-0.9822207999999999] in? United Kingdom

```

*/

const PipelineBuilder = require('fiftyone.pipeline.core').PipelineBuilder;

const fs = require('fs');

const configFile = fs.readFileSync((process.env.directory || __dirname) +
  '/51d.json');

const config = JSON.parse(configFile);
let resourceKeySet = true;
let resourceKeySetFromFile = true;
// Check if a resource key has been set in the config file.
if (config.PipelineOptions.Elements[0].elementParameters.resourceKey
  .startsWith('!!')) {
  let myResourceKey;
  // Check if there is a resource key in the global variable and use it if
  // there is one.
  try {
    myResourceKey = resourceKey;
  } catch (e) {
    if (e instanceof ReferenceError) {
      console.log(e);
    }
  }

  // If not, check the resource key environment variable.
  if (typeof myResourceKey === 'undefined' ||
    myResourceKey.startsWith('!!')) {
    myResourceKey = process.env.RESOURCE_KEY;
  }

  if (myResourceKey) {
    // If there is a resource key in the environment variable then use it.
    config.PipelineOptions.Elements[0].elementParameters.resourceKey =
      myResourceKey;
  } else {
    // If not, display a message to the user and don't execute the
    // rest of the example.
    resourceKeySet = false;
    console.log('You need to create a resource key at ' +
        'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-configurefromfile.js&utm_term=resource-key-required and paste it into the 51d.json ' +
        'config file, replacing !!YOUR_RESOURCE_KEY!!.');
  }

  resourceKeySetFromFile = false;
}

if (resourceKeySet) {
  let pipeline = null;
  if (resourceKeySetFromFile) {
    // Create a new pipeline from the supplied config file.
    pipeline = new PipelineBuilder()
      .buildFromConfigurationFile((process.env.directory || __dirname) +
        '/51d.json');
  } else {
    // Create a new pipeline from the config object.
    pipeline = new PipelineBuilder().buildFromConfiguration(config);
  }

  // Logging of errors and other messages. Valid logs types are info, debug,
  // warn, error
  pipeline.on('error', console.error);

  const getCountry = async function (latitude, longitude) {
    // Create a flow data element and process the latitude and longitude.
    const flowData = pipeline.createFlowData();

    // Add the longitude and latitude as evidence
    flowData.evidence.add('query.51D_Pos_latitude', latitude);
    flowData.evidence.add('query.51D_Pos_longitude', longitude);

    await flowData.process();

    const country = flowData.location.country;

    if (country.hasValue) {
      console.log(`Which country is the location [${latitude},${longitude}] ` +
        `in? ${country.value}`);
    } else {
      // Echo out why the value isn't meaningful
      console.log(country.noValueMessage);
    }
  };

  getCountry('51.458048', '-0.9822207999999999');
}
