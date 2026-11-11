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
 * @example onpremise/automaticupdates/updatePollingInterval.js
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/updatePollingInterval.js).
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

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremisePipelineBuilder;

const ExampleUtils = require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;

// In this example, by default, the 51degrees "Lite" file needs to be in the
// cxx/data/ip-intelligence folder, where it is downloaded if missing,
// or you may specify another file as a command line parameter.
//
// Note that the Lite data file is only used for illustration, and has
// a small number of Properties.
// Contact us for a copy of the Enterprise data file at
// https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-automaticupdates-updatepollinginterval.js&utm_term=lite_v_4_1_ipi
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

// Load in a datafile
const args = process.argv.slice(2);
// Use the supplied path for the data file, the path in the
// _51DEGREES_IPI_PATH environment variable, or find the lite
// file that is included in the repository.
const datafile = args.length > 0 ? args[0] : ExampleUtils.findDataFile(LITE_V_4_1_IPI);

// Set your licence key in the _51DEGREES_LICENSE_KEY environment
// variable. Contact us for a licence key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-automaticupdates-updatepollinginterval.js&utm_term=mylicensekey

const myLicenseKey = process.env._51DEGREES_LICENSE_KEY ||
  '!!YOUR_LICENSE_KEY!!';

if (myLicenseKey === '!!YOUR_LICENSE_KEY!!') {
  console.log('This example updates the data file automatically, which needs ' +
    'a licence key. Set it in the _51DEGREES_LICENSE_KEY environment ' +
    'variable. Contact us for a licence key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-automaticupdates-updatepollinginterval.js&utm_term=license-key-required');
} else {
  // Check if datafile exists

  const fs = require('fs');
  if (!fs.existsSync(datafile)) {
    console.error('Failed to find an IP intelligence ' +
      'data file. Make sure the cxx/data submodule ' +
      'has been fetched by running ' +
      '`git submodule update --init --recursive`.');
    throw ("No data file at '" + datafile + "'");
  }

  // Create the IP intelligence pipeline with the following options
  // to configure the update polling interval. There is no console output
  // when the update is complete but you can check the modified date
  // of the data file to confirm the update has occurred.
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    // Path to your data file
    dataFile: datafile,
    // With a licence key the update replaces the file with the Enterprise
    // data file, which is about 6 GB, so the low memory profile reads the
    // file as it goes rather than holding all of it in memory.
    performanceProfile: 'LowMemory',
    // For automatic updates to work you will need to provide a license key.
    // Contact us for a licence key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-automaticupdates-updatepollinginterval.js&utm_term=licencekeys
    licenceKeys: myLicenseKey,
    // Enable automatic updates.
    autoUpdate: true,
    // Set the frequency in minutes that the pipeline should
    // check for updates to data files. A recommended
    // polling interval in a production environment is
    // around 30 minutes.
    pollingInterval: 1,
    // Set the max ammount of time in seconds that should be
    // added to the polling interval. This is useful in datacenter
    // applications where mulitple instances may be polling for
    // updates at the same time. A recommended ammount in production
    // environments is 600 seconds.
    updateTimeMaximumRandomisation: 10
  }).build();

  // To monitor the pipeline we can put in listeners for various log events.
  // Valid types are info, debug, warn, error
  pipeline.on('error', console.error);

  // Exit auto update process
  setTimeout(() => {
    console.log('Exiting auto update process');
    process.exit(1);
  }, 3000);
}
