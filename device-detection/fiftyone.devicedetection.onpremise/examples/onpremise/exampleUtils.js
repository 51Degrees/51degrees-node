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

const childProcess = require('child_process');

const fs = require('fs');

const path = require('path');

const swigHelpers = require(path.join(__dirname, '/../../swigHelpers'));

// Timeout used when searching for file
const FIND_FILE_TIMEOUT_MS = 10000;

// The data submodule of the cxx submodule at the root of this repository.
// Each data file it links to is listed as <file>.link in one of these
// folders, and its scripts download the file beside the link.
const DATA_DIR = path.join(__dirname, '..', '..', '..', '..', 'cxx', 'data');
const DATA_FOLDERS = ['device-detection', 'ip-intelligence'];

// Sent with each download, so that downloads can be counted by where they
// come from.
const DATA_FILES_SOURCE = 'examples-51degrees-node';

// If data file is older than this number of days then a warning will
// be displayed.
const DATA_FILE_AGE_WARNING = 30;

// The environment variable that can be used to supply an explicit
// path to the device detection data file. This is checked before
// searching the folder hierarchy for the file. The name is the one
// the 51Degrees APIs share.
const DATA_FILE_PATH_ENV_VAR = '51DEGREES_DD_PATH';

// The name these examples used before the one above was agreed. It is
// still read, after the agreed name, so existing set ups keep working.
const LEGACY_DATA_FILE_PATH_ENV_VAR = '_51DEGREES_DD_PATH';

/**
 * Get the command that downloads one of the data submodule's files.
 *
 * @param {string} fileName the name of the file
 * @returns {object} the program, its arguments and the command as text
 */
const getDataFilesCommand = (fileName) => {
  if (process.platform === 'win32') {
    const script = path.join(DATA_DIR, 'get-data-files.ps1');
    return {
      program: 'powershell',
      args: [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
        fileName, '-Source', DATA_FILES_SOURCE
      ],
      text: 'powershell -NoProfile -ExecutionPolicy Bypass -File ' +
        `"${script}" "${fileName}" -Source ${DATA_FILES_SOURCE}`
    };
  }
  const script = path.join(DATA_DIR, 'get-data-files.sh');
  return {
    program: 'sh',
    args: [script, '-s', DATA_FILES_SOURCE, fileName],
    text: `sh "${script}" -s ${DATA_FILES_SOURCE} "${fileName}"`
  };
};

/**
 * Get a file the data submodule links to from the folder holding the
 * link, running the submodule's script to download it when it is missing.
 *
 * @param {string} folder the data submodule folder holding the link
 * @param {string} fileName the name of the file
 * @returns {string|undefined} the path of the file, or undefined when it
 * could not be downloaded
 */
const getLinkedFile = (folder, fileName) => {
  const filePath = path.join(DATA_DIR, folder, fileName);
  if (fs.existsSync(filePath)) return filePath;
  const command = getDataFilesCommand(fileName);
  console.info(`${fileName} is missing, so it is being downloaded by ` +
    `running ${command.text}`);
  const result = childProcess.spawnSync(
    command.program, command.args, { stdio: 'inherit' });
  if (result.status === 0 && fs.existsSync(filePath)) return filePath;
  console.error(`${fileName} could not be downloaded. Run ` +
    `${command.text} to get it.`);
  return undefined;
};

class ExampleUtils {
  // Find the specified filename. A file the data submodule links to is
  // read from the folder holding the link, and downloaded there when it is
  // missing. Any other file is searched for within the default lookup
  // directory.
  static findFile (fileName) {
    const folder = DATA_FOLDERS.find((name) =>
      fs.existsSync(path.join(DATA_DIR, name, `${fileName}.link`)));
    if (folder !== undefined) return getLinkedFile(folder, fileName);
    return this.privateFindFile(
      fileName,
      new Date().getTime() + FIND_FILE_TIMEOUT_MS,
      path.normalize(process.cwd()));
  }

  // Get the explicit data file path from the environment. The variable
  // named by DATA_FILE_PATH_ENV_VAR is read first, then the one named by
  // LEGACY_DATA_FILE_PATH_ENV_VAR. Returns undefined if neither is set.
  static getDataFilePathFromEnv () {
    return process.env[DATA_FILE_PATH_ENV_VAR] ||
      process.env[LEGACY_DATA_FILE_PATH_ENV_VAR] ||
      undefined;
  }

  // Get the path to a device detection data file. The environment is
  // checked first for an explicit path (see getDataFilePathFromEnv). If
  // no path is set there then the file is found with findFile.
  static findDataFile (fileName) {
    return this.getDataFilePathFromEnv() || this.findFile(fileName);
  }

  static isTimedOut (timeout) {
    return new Date().getTime() > timeout;
  }

  static privateFindFile (fileName, timeout, lookupDir, visited = []) {
    // Stop if no look up directory is provided
    if (lookupDir === undefined) return undefined;
    // Stop if timed out
    if (this.isTimedOut(timeout)) return undefined;

    const dirItems = fs.readdirSync(lookupDir);
    const dirs = [];
    for (const item of dirItems) {
      const fullPath = path.resolve(`${lookupDir}/${item}`);
      if (fs.lstatSync(fullPath).isDirectory() &&
        !visited.includes(fullPath) &&
        !item.toLocaleLowerCase().includes('node_modules')) {
        dirs.push(fullPath);
      } else {
        if (item === fileName) return fullPath;
      }
    }

    // Search for file in the sub directories
    while (dirs.length > 0) {
      const file = this.privateFindFile(fileName, timeout, dirs.pop(), visited);
      if (file !== undefined) return file;
    }
    // Add directory to the visited list.
    visited.push(lookupDir);

    // Search for file in the parent directory
    const parentDir = path.resolve(path.dirname(lookupDir));
    if (parentDir !== undefined && !visited.includes(parentDir)) {
      return this.privateFindFile(fileName, timeout, parentDir, visited);
    }

    return undefined;
  }

  static getDataTier (pipeline) {
    const ddEngine = pipeline.flowElements.device;
    return ddEngine ? ddEngine.engine.getProduct() : undefined;
  }

  static checkDataFile (pipeline, filePath) {
    // Get the 'engine' element within the pipeline that
    // performs device detection. We can use this to get
    // details about the data file as well as meta-data
    // describing things such as the available properties.
    const ddEngine = pipeline.flowElements.device;
    let dateTime;
    let dataTier;
    if (ddEngine !== undefined) {
      dateTime = swigHelpers.swigDateToDate(ddEngine.engine.getPublishedTime());
      dataTier = ddEngine.engine.getProduct();
      console.info('Using a ' +
        `${dataTier} data file created ` +
        `${dateTime} from location ` +
        `${filePath}`);
    }

    if (new Date().getTime() > new Date(dateTime + DATA_FILE_AGE_WARNING).getTime()) {
      console.warn('This example is using a data file ' +
        `that is more than ${DATA_FILE_AGE_WARNING} days old. ` +
        'A more recent data file may be needed to ' +
        'correctly detect the latest devices, browsers, ' +
        'etc. To get the latest lite data file, run the ' +
        'get-data-files script in the cxx/data submodule ' +
        '(https://github.com/51Degrees/data) with -u, or ' +
        '-Update in PowerShell. ' +
        'Find out about the Enterprise data file, which ' +
        'includes automatic daily updates, on our pricing ' +
        'page: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-exampleutils.js&utm_term=data-file-age-warning');
    }
    if (dataTier === 'Lite') {
      console.warn('This example is using the \'Lite\' ' +
        'data file. This is used for illustration, and ' +
        'has limited accuracy and capabilities. Find ' +
        'out about the Enterprise data file on our ' +
        'pricing page: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-exampleutils.js&utm_term=lite-data-file');
    }
  }

  static sortMap (map, sortFunc) {
    const tupleArray = [];
    map.forEach((value, key, map) => { tupleArray.push([key, value]); });
    tupleArray.sort(sortFunc);
    return new Map(tupleArray);
  }
}

module.exports = {
  ExampleUtils,
  DATA_FILE_AGE_WARNING,
  DATA_FILE_PATH_ENV_VAR,
  LEGACY_DATA_FILE_PATH_ENV_VAR
};
