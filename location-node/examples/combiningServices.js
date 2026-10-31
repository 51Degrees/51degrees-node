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
@example combiningServices.js

Example of using the 51Degrees geo-location Cloud alongside 51Degrees device detection to determine the country and device for a given longitude, latitude and User-Agent.

This example is available in full on [GitHub](https://github.com/51Degrees/location-node/blob/main/examples/combiningServices.js).

To run this example, you will need to create a **resource key**.
The resource key is used as short-hand to store the particular set of
properties you are interested in as well as any associated license keys
that entitle you to increased request limits and/or paid-for properties.

You will also need to install the fiftyone.devicedetection package with
`npm install fiftyone.devicedetection`.

You can create a resource key using the 51Degrees [Configurator](https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-combiningservices.js&utm_term=top).

*/

const FiftyOneDegreesGeoLocation = require((process.env.directory || __dirname) + '/../');
let FiftyOneDegreesDeviceDetection = null;
try {
  FiftyOneDegreesDeviceDetection = require('fiftyone.devicedetection');
} catch (e) {
  console.log('DeviceDetection is not included in package.json to avoid an ' +
    'unnecessary package dependency. If you wish to run this example ' +
    'then execute "npm install fiftyone.devicedetection" and try again.');
}

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
// You need to create a resource key at https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-combiningservices.js&utm_term=top-2 and
// paste it into the code, replacing !!YOUR_RESOURCE_KEY!!.
// Make sure to include the isMobile and country properties as they
// are used by this example.
if (typeof localResourceKey === 'undefined' ||
  localResourceKey.substr(0, 2) === '!!') {
  localResourceKey = process.env.RESOURCE_KEY || '!!YOUR_RESOURCE_KEY!!';
}

if (localResourceKey.substr(0, 2) === '!!') {
  console.log('You need to create a resource key at ' +
    'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=location-node&utm_content=examples-combiningservices.js&utm_term=resource-key-required and paste it into the code, ' +
    'replacing !!YOUR_RESOURCE_KEY!!.');
  console.log('Make sure to include the ismobile property ' +
    'as it is used by this example.');
} else if (FiftyOneDegreesDeviceDetection) {
  const pipeline = new FiftyOneDegreesDeviceDetection.DeviceDetectionPipelineBuilder({
    resourceKey: localResourceKey
  })
    .add(new FiftyOneDegreesGeoLocation.GeoLocationCloud({
      locationProvider: 'fiftyonedegrees'
    }))
    .build();

  // Logging of errors and other messages. Valid logs types are info, debug, warn, error
  pipeline.on('error', console.error);

  const getProperties = async function (latitude, longitude, userAgent) {
    // Create a flow data element and process the latitude, longitude
    // and User-Agent.
    const flowData = pipeline.createFlowData();

    // Add the longitude and latitude as evidence
    flowData.evidence.add('query.51D_Pos_latitude', latitude);
    flowData.evidence.add('query.51D_Pos_longitude', longitude);
    flowData.evidence.add('header.user-agent', userAgent);

    await flowData.process();

    const country = flowData.location.country;
    const isMobile = flowData.device.ismobile;

    if (country.hasValue) {
      console.log(`Which country is the location [${latitude},${longitude}] in? ${country.value}`);
    } else {
      // Echo out why the value isn't meaningful
      console.log(country.noValueMessage);
    }

    if (isMobile.hasValue) {
      console.log(`Does the User-Agent '${userAgent}' represent a mobile device? ${isMobile.value}`);
    } else {
      // Echo out why the value isn't meaningful
      console.log(isMobile.noValueMessage);
    }
  };

  const mobileUserAgent = 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_2 like Mac OS X) AppleWebKit/604.4.7 (KHTML, like Gecko) Mobile/15C114';

  getProperties('51.458048', '-0.9822207999999999', mobileUserAgent);
}
