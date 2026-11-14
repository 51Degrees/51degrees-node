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
 * @example onpremise/automaticupdates/dataFileSystemWatcher.js
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/automaticupdates/dataFileSystemWatcher.js).
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

const DeviceDetectionOnPremisePipelineBuilder =
  require51('fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;

// Where to go next, printed at every end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/device-detection',
  '\tThe device detection engine: https://github.com/51Degrees/51degrees-cxx',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tDevice detection documentation: https://51degrees.com/documentation/_device_detection__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=find-out-more-documentation',
  '\tData files and pricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=find-out-more-contact'
].join('\n');

// In this example, by default, the 51degrees "Lite" file needs to be in the
// cxx/data/device-detection folder, where it is downloaded if missing,
// or you may specify another file as a command line parameter.
//
// Note that the Lite data file is only used for illustration, and has
// a small number of Properties.
// Contact us for a copy of the Enterprise data file at
// https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=lite_v_4_1_hash
const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';

// Set your licence key in the _51DEGREES_LICENSE_KEY environment
// variable. Contact us for a licence key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=top

// LICENSE_KEY is the deprecated name of the same variable, read only
// when _51DEGREES_LICENSE_KEY is unset or empty.
if (!process.env._51DEGREES_LICENSE_KEY && process.env.LICENSE_KEY) {
  console.warn('The LICENSE_KEY environment variable is deprecated and ' +
    '_51DEGREES_LICENSE_KEY replaces it. Set _51DEGREES_LICENSE_KEY ' +
    'instead.');
}
const myLicenseKey = process.env._51DEGREES_LICENSE_KEY ||
  process.env.LICENSE_KEY || '!!YOUR_LICENSE_KEY!!';

if (myLicenseKey === '!!YOUR_LICENSE_KEY!!') {
  console.log('This example updates the data file automatically, which needs ' +
    'a licence key. Set it in the _51DEGREES_LICENSE_KEY environment ' +
    'variable. Contact us for a licence key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=license-key-required');
  console.log(FIND_OUT_MORE);
} else {
  // Use the supplied path for the data file, the '_51DEGREES_DD_PATH'
  // environment variable, or find the Lite data file. This is only done
  // once there is a licence key, so that a data file is not downloaded only
  // to be told a key is needed.
  const args = process.argv.slice(2);
  const datafile = args.length > 0
    ? args[0]
    : ExampleUtils.findDataFile(LITE_V_4_1_HASH);

  // Check if datafile exists

  const fs = require('fs');
  if (!fs.existsSync(datafile)) {
    console.error('Failed to find a device detection ' +
      'data file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`.');
    throw ("No data file at '" + datafile + "'");
  }

  // Create the device detection pipeline with the following options
  // to configure the file system watcher. There is no console output
  // when the update is complete.
  const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
    // Path to your data file
    dataFile: datafile,
    // For automatic updates to work you will need to provide a license key.
    // Contact us for a licence key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-automaticupdates-datafilesystemwatcher.js&utm_term=licencekeys
    licenceKeys: myLicenseKey,
    // Enable automatic updates.
    autoUpdate: true,
    // Watch the data file on disk and refresh the engine
    // as soon as that file is updated.
    fileSystemWatcher: true
  }).build();

  // To monitor the pipeline we can put in listeners for various log events.
  // Valid types are info, debug, warn, error
  pipeline.on('error', console.error);

  // Exit auto update process
  setTimeout(() => {
    console.log('Exiting auto update process');
    console.log(FIND_OUT_MORE);
    // The example has shown how to set updates up, so it ends as a success.
    process.exit(0);
  }, 3000);
}
