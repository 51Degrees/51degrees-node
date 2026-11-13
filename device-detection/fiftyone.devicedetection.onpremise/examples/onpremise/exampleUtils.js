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

const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const dataExtension = require51('fiftyone.devicedetection.shared').dataExtension;

// Timeout used when searching for file
const FIND_FILE_TIMEOUT_MS = 10000;

// The data submodule of the cxx submodule at the root of this repository.
// Each data file it links to is listed as <file>.link in one of these
// folders, and its scripts download the file beside the link.
const DATA_DIR = path.join(__dirname, '..', '..', '..', '..', 'cxx', 'data');
const DATA_FOLDERS = ['device-detection', 'ip-intelligence'];

// Sent with each download, so that downloads can be counted by where they
// come from. It is left out inside GitHub Actions, where the data
// repository's script names the build instead, so that test runs are not
// counted as people using the examples.
const DATA_FILES_SOURCE = 'examples-51degrees-node';

// Shown in place of a value for a property that the data file in use does
// not have.
const NEEDS_ENTERPRISE = 'needs the Enterprise data file';

// The number of milliseconds in a day, for the data file age check.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// If data file is older than this number of days then a warning will
// be displayed.
const DATA_FILE_AGE_WARNING = 30;

// The environment variable that can be used to supply an explicit
// path to the device detection data file. This is checked before
// searching the folder hierarchy for the file. The name is the one
// the 51Degrees APIs share.
const DATA_FILE_PATH_VARIABLE = '_51DEGREES_DD_PATH';

/**
 * The name the variable had when it began with the digit.
 *
 * @deprecated Set the variable DATA_FILE_PATH_VARIABLE names. This name
 * is read only when that variable is unset or empty.
 */
const DATA_FILE_PATH_ENV_VAR = '51DEGREES_DD_PATH';

/**
 * The second name the data file path was read from.
 *
 * @deprecated Use DATA_FILE_PATH_VARIABLE, which holds the same name.
 */
const LEGACY_DATA_FILE_PATH_ENV_VAR = '_51DEGREES_DD_PATH';

// The old names already said to be deprecated, so each is said once.
const reportedOldNames = new Set();

/**
 * Prints, once for each old name, that the name is deprecated and which
 * name replaces it.
 *
 * @param {string} oldName the deprecated environment variable name
 * @param {string} name the name that replaces it
 */
const reportOldName = function (oldName, name) {
  if (reportedOldNames.has(oldName) === false) {
    reportedOldNames.add(oldName);
    console.warn(`The ${oldName} environment variable is deprecated and ` +
      `${name} replaces it. Set ${name} instead.`);
  }
};

/**
 * Reads an environment variable under its name and, when that is unset or
 * empty, under the deprecated names it had before, in order.
 *
 * @param {string} name the environment variable name
 * @param {...string} oldNames the deprecated names it had before
 * @returns {string|undefined} the value, or undefined when none is set
 */
const readVariable = function (name, ...oldNames) {
  if (process.env[name]) {
    return process.env[name];
  }
  for (const oldName of oldNames) {
    if (process.env[oldName]) {
      reportOldName(oldName, name);
      return process.env[oldName];
    }
  }
  return undefined;
};

/**
 * Get the command that downloads one of the data submodule's files.
 *
 * @param {string} fileName the name of the file
 * @returns {object} the program, its arguments and the command as text
 */
const getDataFilesCommand = (fileName) => {
  const inActions = process.env.GITHUB_ACTIONS === 'true';
  if (process.platform === 'win32') {
    const script = path.join(DATA_DIR, 'get-data-files.ps1');
    // PowerShell 7 when it is on the path, otherwise Windows PowerShell,
    // which, started from PowerShell 7, inherits its module path and then
    // cannot load its own commands.
    const pwsh = childProcess.spawnSync('where', ['pwsh']).status === 0;
    const program = pwsh ? 'pwsh' : 'powershell';
    const env = Object.assign({}, process.env);
    if (!pwsh) delete env.PSModulePath;
    const source = inActions ? [] : ['-Source', DATA_FILES_SOURCE];
    return {
      program,
      args: [
        '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script,
        fileName, ...source
      ],
      env,
      text: `${program} -NoProfile -ExecutionPolicy Bypass -File ` +
        `"${script}" "${fileName}"` + source.map((a) => ` ${a}`).join('')
    };
  }
  const script = path.join(DATA_DIR, 'get-data-files.sh');
  const source = inActions ? [] : ['-s', DATA_FILES_SOURCE];
  return {
    program: 'sh',
    args: [script, ...source, fileName],
    env: process.env,
    text: `sh "${script}"` + source.map((a) => ` ${a}`).join('') +
      ` "${fileName}"`
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
    command.program, command.args, { stdio: 'inherit', env: command.env });
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

  // Get the explicit data file path from the environment, read from the
  // variable named by DATA_FILE_PATH_VARIABLE, then from the deprecated
  // name when that is unset or empty. Returns undefined when neither is
  // set.
  static getDataFilePathFromEnv () {
    return readVariable(DATA_FILE_PATH_VARIABLE, DATA_FILE_PATH_ENV_VAR);
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

  // Search the look up directory and every directory below it, then each
  // directory above it in turn, until the file is found or the time runs
  // out. The directories waiting to be searched are kept in a list rather
  // than searched by recursion, so a large tree cannot overflow the stack,
  // and a directory that cannot be read is skipped.
  static privateFindFile (fileName, timeout, lookupDir) {
    const visited = new Set();
    let start = lookupDir;
    while (start !== undefined) {
      const pending = [start];
      while (pending.length > 0) {
        if (this.isTimedOut(timeout)) return undefined;
        const dir = pending.pop();
        if (visited.has(dir)) continue;
        visited.add(dir);
        let items;
        try {
          items = fs.readdirSync(dir, { withFileTypes: true });
        } catch (e) {
          continue;
        }
        for (const item of items) {
          const fullPath = path.resolve(dir, item.name);
          if (item.isDirectory()) {
            if (!item.name.toLocaleLowerCase().includes('node_modules')) {
              pending.push(fullPath);
            }
          } else if (item.name === fileName) {
            return fullPath;
          }
        }
      }
      const parent = path.dirname(start);
      start = parent !== start ? parent : undefined;
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

    if (dateTime !== undefined &&
      Date.now() > dateTime.getTime() + DATA_FILE_AGE_WARNING * MS_PER_DAY) {
      console.warn('This example is using a data file ' +
        `that is more than ${DATA_FILE_AGE_WARNING} days old. ` +
        'A more recent data file may be needed to ' +
        'correctly detect the latest devices, browsers, ' +
        'etc. To get the latest lite data file, run the ' +
        'get-data-files script in the cxx/data submodule ' +
        '(https://github.com/51Degrees/data) with -u, or ' +
        '-Update in PowerShell. ' +
        'Contact us about the Enterprise data file, which ' +
        'includes automatic daily updates, at ' +
        'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.onpremise-examples-onpremise-exampleutils.js&utm_term=data-file-age-warning');
    }
  }

  // True when the engine's data file has the property. The data file's
  // own list is read, because an engine's properties are only those it was
  // built to give.
  static hasProperty (engine, name) {
    const properties = engine.engine.getMetaData().getProperties();
    const wanted = name.toLowerCase();
    for (let i = 0; i < properties.getSize(); i++) {
      if (properties.getByIndex(i).getName().toLowerCase() === wanted) {
        return true;
      }
    }
    return false;
  }

  // Format a property for display, or say that it needs the Enterprise
  // data file when the engine's data file does not have it. The value is
  // only read when the data file has the property.
  static getEnterpriseValue (engine, elementData, name) {
    if (!this.hasProperty(engine, name)) return NEEDS_ENTERPRISE;
    return dataExtension.getValueHelper(elementData, name.toLowerCase());
  }

  // Where to ask for a copy of the Enterprise data file, written after an
  // example has shown properties that the data file in use does not have.
  // The link is tagged with the example's file, so that an enquiry can be
  // traced to the example.
  static getEnterpriseNote (contactUs) {
    return 'Some of these properties need the Enterprise data file. ' +
      `Contact us for a copy at ${contactUs}`;
  }

  // True when the engine uses the free Lite data file.
  static isLiteDataFile (engine) {
    return engine.engine.getProduct() === 'Lite';
  }

  // What the Enterprise data file adds and where to ask for a copy, written
  // after an example that shows no properties has run on the free Lite data
  // file.
  static getEnterpriseOffer (contactUs) {
    return 'This example used the free Lite data file. The Enterprise data ' +
      'file adds many more properties, such as HardwareVendor, ' +
      `HardwareName and DeviceType. Contact us for a copy at ${contactUs}`;
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
  NEEDS_ENTERPRISE,
  DATA_FILE_AGE_WARNING,
  DATA_FILE_PATH_VARIABLE,
  DATA_FILE_PATH_ENV_VAR,
  LEGACY_DATA_FILE_PATH_ENV_VAR
};
