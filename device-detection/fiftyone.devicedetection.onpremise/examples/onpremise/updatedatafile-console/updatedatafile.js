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

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const os = require('os');
const DataFileUpdateService = require('fiftyone.pipeline.engines').DataFileUpdateService;
const AutoUpdateStatus = require('fiftyone.pipeline.engines').AutoUpdateStatus;
const DeviceDetectionOnPremisePipelineBuilder =
  require51('fiftyone.devicedetection.onpremise').DeviceDetectionOnPremisePipelineBuilder;

const { ExampleUtils } =
  require(path.join(__dirname, '/../exampleUtils'));
const ExampleConstants = require51('fiftyone.devicedetection.shared').exampleConstants;
const KeyUtils = require51('fiftyone.devicedetection.shared').keyUtils;

/**
 * @example onpremise/updatedatafile-console/updatedatafile.js
 * This example illustrates various parameters that can be adjusted when using the on-premise
 * device detection engine, and controls when a new data file is sought and when it is loaded by
 * the device detection software.
 *
 * Three main aspects are demonstrated:
 *  - Update on Start-Up
 *  - Filesystem Watcher
 *  - Daily auto-update
 *
 * ## License Key
 * Updating the data file needs a 51Degrees licence key for the Enterprise data file.
 * Without one, the example shows the free Lite data file and says where to ask for a key.
 * Contact us for a key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=header
 * # Data Files
 * You can find out more about data files, licenses etc. at our (FAQ page)[https://51degrees.com/resources/faqs?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=header]
 * ## Enterprise Data File
 * Enterprise (fully-featured) data files are typically released by 51Degrees four days a week
 * (Mon-Thu) and on-premise deployments can fetch and download those files automatically. Equally,
 * customers may choose to download the files themselves and move them into place to be detected
 * by the 51Degrees filesystem watcher.
 * ### Manual Download
 * If you prefer to download files yourself, you may do so here:
 * ```
 * https://distributor.51degrees.com/api/v2/download?LicenseKeys=<your_license_key>&Type=27&Download=True&Product=22
 * ```
 * ## Lite Data File
 * Lite data files (free-to-use, with a small number of Properties, no license key required) are created roughly
 * once a month and cannot be updated using auto-update, they may be downloaded with the
 * scripts in the (data repository)[href=https://github.com/51Degrees/data], which is
 * included with source distributions of this software.
 * # Update on Start-Up
 * You can configure the pipeline builder to download an Enterprise data file on start-up.
 * ## Pre-Requisites
 * - a license key
 * - a file location for the download
 *      - this may be an existing file - which will be overwritten
 *      - or if it does not exist must end in ".hash" and must be in an existing directory
 * ## Configuration
 * - the pipeline must be configured to use a temp file
 * ``` {js}
 *    createTempDataCopy: true
 * ```
 * - a DataFileUpdateService must be supplied
 * ``` {js}
 *      dataUpdateService.on('updateComplete', function(status, dataFile) {
 *          // do something with the result.
 *      });
 *  ...
 *      dataFileUpdateService: dataUpdateService
 * ```
 * - update on start-up must be specified, which will cause pipeline creation to block until a
 * file is downloaded
 * ``` {js}
 *      updateOnStart: true
 * ```
 * # File System Watcher
 * You can configure the pipeline builder to watch for changes to the currently loaded device
 * detection data file, and to replace the file currently in use with the new one. This is
 * useful, for example, if you wish to download and update the device detection file "manually" -
 * i.e. you would download it then drop it into place with the same path as the currently loaded
 * file. That location is checked periodically (by default every 30 mins) and this frequency can be
 * configured.
 *
 * ## Pre-Requisites
 * - a license key
 * - the file location of the existing file
 * ## Configuration
 * - the pipeline must be configured to use a temp file
 * ``` {js}
 *    createTempDataCopy: true
 * ```
 * - a DataFileUpdateService must be supplied
 * ``` {js}
 *      dataUpdateService.on('updateComplete', function(status, dataFile) {
 *          // do something with the result.
 *      });
 *  ...
 *      dataFileUpdateService: dataUpdateService
 * ```
 * - configure the frequency with which the location is checked, in seconds (10 mins as shown)
 * ``` {js}
 *      pollingInterval: 10*60
 * ```
 * ## Daily auto-update
 * Enterprise data files are usually created four times a week. Each data file contains a date
 * for when the next data file is expected. You can configure the pipeline so that it starts
 * looking for a newer data file after that time, by connecting to the 51Degrees distributor to
 * see if an update is available. If one is, then it is downloaded and will replace the existing
 * device detection file, which is currently in use.
 *
 * ## Pre-Requisites
 * - a license key
 * - the file location of the existing file
 * ## Configuration
 * - the pipeline must be configured to use a temp file
 * ``` {js}
 *    createTempDataCopy: true
 * ```
 * - a DataFileUpdateService must be supplied
 * ``` {js}
 *      dataUpdateService.on('updateComplete', function(status, dataFile) {
 *          // do something with the result.
 *      });
 *  ...
 *      dataFileUpdateService: dataUpdateService
 * ```
 * - Set the frequency in seconds that the pipeline should check for updates to data files.
 * A recommended polling interval in a production environment is around 30 minutes.
 * ``` {js}
 *      pollingInterval: 10*60
 * ```
 * - Set the max amount of time in seconds that should be added to the polling interval. This is
 * useful in datacenter applications where multiple instances may be polling for  updates at the
 * same time. A recommended ammount in production  environments is 600 seconds.
 * ``` {js}
 *     updateTimeMaximumRandomisation: 10*60
 * ```
 * # Location
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/device-detection/fiftyone.devicedetection.onpremise/examples/onpremise/updatedatafile-console/updatedatafile.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.engines](https://www.npmjs.com/package/fiftyone.pipeline.engines)
 * - [fiftyone.pipeline.engines.fiftyone](https://www.npmjs.com/package/fiftyone.pipeline.engines.fiftyone)
 * - [fiftyone.devicedetection.onpremise](https://www.npmjs.com/package/fiftyone.devicedetection.onpremise)
 */

// The variable that holds the license key.
const LICENSE_KEY_VARIABLE = '_51DEGREES_LICENSE_KEY';

// Reads the license key from the environment.
const getLicenseKey = function () {
  return process.env[LICENSE_KEY_VARIABLE] || undefined;
};

// The variable that holds the product to download, such as V4TAC.
const PRODUCT_VARIABLE = '_51DEGREES_DD_PRODUCT';

// Reads the product to download from the environment, or undefined when it
// is not set.
const getProduct = function () {
  return process.env[PRODUCT_VARIABLE] || undefined;
};
const DEFAULT_DATA_FILENAME =
  os.homedir() + path.sep + ExampleConstants.fileNames.enterpriseDataFileName;

// Where to ask for a license key and a copy of the Enterprise data file,
// tagged with this example.
const CONTACT_US = 'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=licence-key';

// Where to go next, printed at every end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThis API: https://github.com/51Degrees/51degrees-node/tree/main/device-detection',
  '\tThe device detection engine: https://github.com/51Degrees/51degrees-cxx',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tDevice detection documentation: https://51degrees.com/documentation/_device_detection__overview.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=find-out-more-documentation',
  '\tData files and pricing: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=find-out-more-pricing',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=find-out-more-contact'
].join('\n');

// Without a license key the example cannot download a data file, so it
// shows the data file it would start from, the free Lite data file unless
// another is given, and says what an update needs.
const explainLicenseKey = function (dataFilePath, output) {
  const dataFile = dataFilePath && fs.existsSync(dataFilePath)
    ? dataFilePath
    : ExampleUtils.findDataFile(ExampleConstants.fileNames.liteDataFileName);
  if (dataFile !== undefined && fs.existsSync(dataFile)) {
    const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
      dataFile,
      performanceProfile: 'LowMemory',
      shareUsage: false,
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false
    }).build();
    ExampleUtils.checkDataFile(pipeline, dataFile);
  }
  output.write('Updating the data file downloads the Enterprise data file, ' +
    'which needs a licence key. Give the key as the first command line ' +
    'argument, or in the environment variable ' +
    `'${LICENSE_KEY_VARIABLE}'. Contact us for a key and a copy ` +
    `at ${CONTACT_US}\n`);
};

// The address the data file is downloaded from.
const DATA_UPDATE_URL = 'https://distributor.51degrees.com/api/v2/download';

// The settings that name the product to download, such as V4TAC, which a
// license key that holds several products needs. With no product given
// there are none, so the request names no product and a license key that
// holds one product gets its data file. A product is named by giving the
// whole update URL, with the default parameters turned off.
const productSettings = function (licenseKey, product) {
  if (!product) {
    return {};
  }
  return {
    dataUpdateUrl: DATA_UPDATE_URL + '?' + new URLSearchParams({
      Product: product,
      Type: 'HashV41',
      Download: 'True',
      licenseKeys: licenseKey
    }).toString(),
    dataUpdateUseUrlFormatter: false
  };
};

const run = async function (dataFilePath, licenseKey, interactive, output,
  product) {
  output.write('Starting example\n');
  // try to find a license key
  if (!licenseKey) {
    licenseKey = getLicenseKey();
  }
  // Name a product only when one was given or is set in the environment.
  if (!product) {
    product = getProduct();
  }
  if (!licenseKey || KeyUtils.isInvalidKey(licenseKey)) {
    explainLicenseKey(dataFilePath, output);
    return;
  }

  // work out where the downloaded file will be put, directory must exist
  if (dataFilePath) {
    try {
      dataFilePath = ExampleUtils.findFile(dataFilePath);
    } catch (e) {
      if (fs.existsSync(path.dirname(dataFilePath))) {
        console.error('The directory must exist when specifying a location for a new ' +
          `file to be downloaded. Path specified was '${dataFilePath}'`);
        throw new Error('Directory for new file must exist');
      }
      console.warn(`File ${dataFilePath} not found, a file will be downloaded to that location on ` +
        'start-up');
    }
  }
  // no filename specified, check the environment variable for an
  // explicit path before falling back to the default
  if (!dataFilePath) {
    dataFilePath = ExampleUtils.getDataFilePathFromEnv();
  }
  if (!dataFilePath) {
    dataFilePath = DEFAULT_DATA_FILENAME;
    console.warn(`No filename specified. Using default '${dataFilePath}' which will be downloaded to ` +
      'that location on start-up, if it does not exist already');
  }

  const copyDataFile = dataFilePath + '.bak';
  if (fs.existsSync(dataFilePath)) {
    // let's check this file out
    const pipeline = new DeviceDetectionOnPremisePipelineBuilder({
      dataFile: dataFilePath,
      performanceProfile: 'LowMemory',
      shareUsage: false,
      autoUpdate: false,
      updateOnStart: false,
      fileSystemWatcher: false
    }).build();
    // and output the results
    ExampleUtils.checkDataFile(pipeline, dataFilePath);
    if (ExampleUtils.getDataTier(pipeline) === 'Lite') {
      console.error('Will not download an "Enterprise" data file over the top of ' +
        'a "Lite" data file, please supply another location.');
      throw new Error('File supplied has wrong data tier');
    }
    output.write('Existing data file will be replaced with downloaded data file\n');
    output.write(`Existing data file will be copied to ${copyDataFile}\n`);
  }

  // do we really want to do this
  if (interactive) {
    const buffer = Buffer.alloc(1);
    output.write('Please note - this example will use available downloads ' +
      'in your licensed allocation.\n');
    output.write('Do you wish to continue with this example (y)? ');
    fs.readSync(0, buffer, 0, 1);
    const input = buffer.toString('utf8');
    if ((input === os.EOL || input.toLowerCase().startsWith('y')) === false) {
      output.write(`'${input}'\n`);
      output.write('Stopping example without download\n');
      return;
    }
  }
  output.write('Checking file exists\n');
  if (fs.existsSync(dataFilePath)) {
    fs.copyFileSync(dataFilePath, copyDataFile);
    output.write(`Existing data file copied to ${copyDataFile}\n`);
  }

  output.write('Creating pipeline and initiating update on start-up - please wait for that ' +
    'to complete\n');
  // create update service and add listener
  const dataUpdateService = new DataFileUpdateService();

  // Settles when the example has finished, which is after the pipeline
  // below has been built and both updates have completed.
  //
  // A download writes the new data to the path the file system watcher
  // watches, so the watcher raises events while the download is still
  // being applied. Each of those is reported with the in progress status,
  // which says the check found nothing left to do, so none of them is the
  // result of the check this example asked for. Both waits below pass over
  // them and take the first status that ends a check.
  const whenUpdateEnds = function () {
    return new Promise(resolve => {
      let ended = false;
      dataUpdateService.on('updateComplete', function (status, dataFile) {
        if (!ended && status !== AutoUpdateStatus.AUTO_UPDATE_IN_PROGRESS) {
          ended = true;
          resolve(status);
        }
      });
    });
  };

  const finished = whenUpdateEnds()
    .then(status => {
      output.write(`Update on start-up complete - status: ${status}\n`);

      if (status !== AutoUpdateStatus.AUTO_UPDATE_SUCCESS) {
        output.write('Auto update was not successful, abandoning example\n');
        throw new Error('Auto update failed: ' + status);
      }
    })
    .then(() => {
      output.write('Modifying downloaded file to trigger reload - please wait for that' +
        ' to complete\n');
      // In this example we set a timeout to make sure node waits for the promise
      // to complete. Without this, node exits without waiting for the promise.
      // This is not a neat way of achieving this, but for now it makes the
      // example run as intended.
      const timeoutId = setTimeout(() => {
        output.write('Update on file modification timed out\n');
      }, 60 * 1000);
      // The wait is set up before the file is touched, so that the reload
      // it triggers cannot be missed.
      const reloaded = whenUpdateEnds()
        .then(status => {
          clearTimeout(timeoutId);
          output.write(`Update on file modification complete - status: ${status}\n`);
        });
      try {
        // it's the same file but changing the file metadata will trigger reload,
        // demonstrating that if you download a new file and replace the
        // existing one, then it will be loaded
        const time = new Date();
        fs.utimesSync(dataFilePath, time, time);
      } catch (err) {
        clearTimeout(timeoutId);
        throw new Error('Could not modify file time - abandoning ' +
        'example\n');
      }
      return reloaded;
    })
    .then(() => {
      output.write('Finished example\n');
    });

  // Build the device detection pipeline  and pass in the desired settings to configure
  // automatic updates.
  new DeviceDetectionOnPremisePipelineBuilder({
    dataFileUpdateService: dataUpdateService,
    // specify the filename for the data file. When using update on start-up
    // the file need not exist, but the directory it is in must exist.
    // Any file that is present is overwritten. Because the file will be
    // overwritten the pipeline must be configured to copy the supplied
    // file to a temporary file (createTempDataCopy parameter == true.
    dataFile: dataFilePath,
    createTempDataCopy: true,
    // Enable automatic updates once the pipeline has started
    autoUpdate: true,
    // For automatic updates to work you will need to provide a license key.
    // Contact us for a license key at https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-updatedatafile-console-updatedatafile.js&utm_term=licencekeys
    licenceKeys: licenseKey,
    // Name the product to download only when one was given. A license key
    // that holds several products needs it.
    ...productSettings(licenseKey, product),
    // Enable update on startup, the auto update system
    // will be used to check for an update before the
    // device detection engine is created. This will block
    // creation of the pipeline.
    updateOnStart: true,
    // Watch the data file on disk and refresh the engine
    // as soon as that file is updated.
    fileSystemWatcher: true,
    // for the purposes of this example we are setting the time
    // between checks to see if the file has changed to 1 second
    // by default this is 30 mins
    pollingInterval: 1
  })
  // build the pipeline
    .build();

  return finished;
};

// Don't run the server if under TEST
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file or find the lite
  // file that is included in the repository.
  const licenseKey = args.length > 0 ? args[0] : null;
  const dataFilePath = args.length > 1 ? args[1] : null;
  // The product to download, such as V4TAC, for a license key that holds
  // several products. With none given, the product in
  // _51DEGREES_DD_PRODUCT is named. With neither, no product is named.
  const product = args.length > 2 ? args[2] : null;

  run(dataFilePath, licenseKey, true, process.stdout, product)
    .then(() => console.log(FIND_OUT_MORE));
};

module.exports = { run, getLicenseKey, getProduct, productSettings };
