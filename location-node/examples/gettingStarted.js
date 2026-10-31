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
@example gettingStarted.js

Getting started example of using the 51Degrees geo-location Cloud to determine the country for a given longitude and latitude.

This example is available in full on [GitHub](https://github.com/51Degrees/location-node/blob/main/examples/gettingStarted.js).

To run this example, you will need to create a **resource key**.
The resource key is used as short-hand to store the particular set of
properties you are interested in as well as any associated license keys
that entitle you to increased request limits and/or paid-for properties.

You can create a resource key using the 51Degrees [Configurator](https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-gettingstarted.js&utm_term=top).

Firstly require the fiftyone.geolocation modules which contain all of the pipeline specific classes we will be using in this example.

```

const FiftyOneDegreesGeoLocation = require('fiftyone.geolocation')

```

Build the geo-location pipeline using the builder that comes with the fiftyone.geolocation module and pass in the desired settings. Additional flowElements / engines can be added before the build() method is called if needed.

```

let pipeline = new FiftyOneDegreesGeoLocation.geoLocationPipelineBuilder({
    'resourceKey': localResourceKey
}).build();

```

Each pipeline has an event emitter attached you can listen to to catch messages. Valid log types are info, debug, warn and error.

```

pipeline.on('error', console.error);

```

A pipeline can create a flowData element which is where evidence is added (for example from a device web request). This evidence is then processed by the pipeline through the flowData's `process()` method (which returns a promise to work with both syncronous and asyncronous pipelines).

Here is an example of a function that gets the country from a longitude and latidude. In some cases the country value is not meaningful so instead of returning a default, a .hasValue() check can be made. Please see the failureToMatch example for more information.

```

let getCountry = async function (latitude, longitude) {

    // Create a flow data element and process the latitude and longitude.
    let flowData = pipeline.createFlowData();

    // Add the longitude and latitude as evidence
    flowData.evidence.add('location.latitude', latitude);
    flowData.evidence.add('location.longitude', longitude);

    await flowData.process();

    let country = flowData.location.country;

    if (country.hasValue) {

        console.log(`Country: ${country.value}`);

    } else {

        // Echo out why the value isn't meaningful
        console.log(country.noValueMessage);

    }

}

```

*/

const FiftyOneDegreesGeoLocation = require((process.env.directory || __dirname) + '/../');

let localResourceKey;
// Check if there is a resource key in the global variable and use it if
// there is one.
try {
  localResourceKey = resourceKey;
} catch (e) {
  if (e instanceof ReferenceError) {
    console.log(e);
  }
}
// You need to create a resource key at https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-gettingstarted.js&utm_term=top-2 and
// paste it into the code, replacing !!YOUR_RESOURCE_KEY!!.
if (typeof localResourceKey === 'undefined' ||
  localResourceKey.substr(0, 2) === '!!') {
  localResourceKey = process.env.RESOURCE_KEY || '!!YOUR_RESOURCE_KEY!!';
}

if (localResourceKey.substr(0, 2) === '!!') {
  console.log('You need to create a resource key at ' +
    'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-gettingstarted.js&utm_term=resource-key-required and paste it into the code, ' +
    'replacing !!YOUR_RESOURCE_KEY!!.');
} else {
  const pipeline = new FiftyOneDegreesGeoLocation.GeoLocationPipelineBuilder({
    resourceKey: localResourceKey
  }).build();

  // Logging of errors and other messages. Valid logs types are info, debug, warn, error
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
      console.log(`Which country is the location [${latitude},${longitude}] in? ${country.value}`);
    } else {
      // Echo out why the value isn't meaningful
      console.log(country.noValueMessage);
    }
  };

  getCountry('51.458048', '-0.9822207999999999');
}
