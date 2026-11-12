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

const dataExtension = require51('fiftyone.ipintelligence.shared').dataExtension;

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

// Environment variable that can be set to supply an explicit path to
// the IP intelligence data file. Checked before the folder hierarchy
// is searched.
const IPI_DATA_FILE_ENV_VAR = '_51DEGREES_IPI_PATH';

// Environment variable that can be set to supply an explicit path to
// the device detection data file used by the mixed examples. Checked
// before the folder hierarchy is searched.
const DD_DATA_FILE_ENV_VAR = '_51DEGREES_DD_PATH';

// The names the two variables had when they began with the digit. Each is
// deprecated and read only when the name that replaced it is unset or
// empty.
const DEPRECATED_IPI_DATA_FILE_ENV_VAR = '51DEGREES_IPI_PATH';
const DEPRECATED_DD_DATA_FILE_ENV_VAR = '51DEGREES_DD_PATH';

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

// Content types for the small set of static assets served by the web
// examples. The shared pattern-library CSS and JS live under each
// example's 'public' directory.
const STATIC_CONTENT_TYPES = {
  '.css': 'text/css',
  '.js': 'text/javascript'
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
  // Serve a file from the example's 'public' directory when the request
  // path matches one of the static assets. The web examples use a plain
  // Node http server rather than a framework, so this stands in for the
  // 'static file' middleware found in the equivalent .NET examples.
  // Returns true when a response was sent, false when the request should
  // fall through to the example handler.
  static serveStaticAsset (req, res, publicDir) {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      return false;
    }

    const requestPath = (req.url || '').split('?')[0];
    const ext = path.extname(requestPath).toLowerCase();
    const contentType = STATIC_CONTENT_TYPES[ext];
    if (!contentType) {
      return false;
    }

    // Resolve the path within 'public' and guard against directory
    // traversal by rejecting anything that escapes the public directory.
    const normalised = path
      .normalize(decodeURIComponent(requestPath))
      .replace(/^(\.\.[/\\])+/, '');
    const filePath = path.join(publicDir, normalised);
    if (!filePath.startsWith(path.resolve(publicDir))) {
      return false;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      return false;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    if (req.method === 'HEAD') {
      res.end();
    } else {
      res.end(fs.readFileSync(filePath));
    }
    return true;
  }

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

  // Get the explicit path of the IP intelligence data file from the
  // environment, read from the variable named by IPI_DATA_FILE_ENV_VAR,
  // then from the deprecated name when that is unset or empty. Returns
  // undefined when neither is set.
  static getDataFilePathFromEnv () {
    return readVariable(
      IPI_DATA_FILE_ENV_VAR, DEPRECATED_IPI_DATA_FILE_ENV_VAR);
  }

  // Get the path to an IP intelligence data file. The environment is
  // checked first for an explicit path. If none is set then the file is
  // found with findFile.
  static findDataFile (fileName) {
    return this.getDataFilePathFromEnv() || this.findFile(fileName);
  }

  // Get the path to a device detection data file. The environment
  // variable named by DD_DATA_FILE_ENV_VAR is checked first for an
  // explicit path, then the deprecated name when that is unset or empty.
  // If neither is set then the file is found with findFile.
  static findDeviceDataFile (fileName) {
    return readVariable(
      DD_DATA_FILE_ENV_VAR, DEPRECATED_DD_DATA_FILE_ENV_VAR) ||
      this.findFile(fileName);
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
    const ipiEngine = pipeline.flowElements.ip;
    return ipiEngine ? ipiEngine.engine.getProduct() : undefined;
  }

  static checkDataFile (pipeline, filePath) {
    // Get the 'engine' element within the pipeline that
    // performs IP intelligence. We can use this to get
    // details about the data file as well as meta-data
    // describing things such as the available properties.
    const ipiEngine = pipeline.flowElements.ip;
    let dateTime;
    let dataTier;
    if (ipiEngine !== undefined) {
      dateTime = swigHelpers.swigDateToDate(ipiEngine.engine.getPublishedTime());
      dataTier = ipiEngine.engine.getProduct();
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
        'correctly determine the details of the latest ' +
        'IP ranges. To get the latest lite data file, run the ' +
        'get-data-files script in the cxx/data submodule ' +
        '(https://github.com/51Degrees/data) with -u, or ' +
        '-Update in PowerShell. ' +
        'Contact us about the Enterprise data file, which ' +
        'includes automatic daily updates, at ' +
        'https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-exampleutils.js&utm_term=data-file-age-warning');
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

  // True when the engine uses one of the free data files, Lite or ASN. The
  // free Lite data file has the registration properties, such as
  // RegisteredName, and the free ASN data file the ASN properties, such as
  // AsnName. Only the Enterprise data file has the range properties, so a
  // check for IpRangeStart tells them apart.
  static isFreeDataFile (engine) {
    return !this.hasProperty(engine, 'IpRangeStart');
  }

  // For an example that needs properties only the Enterprise data file
  // has, report when the engine's data file has none of them, and then
  // write which and where to ask for a copy of the Enterprise data file.
  // The purpose is what the example does, as the start of a sentence.
  static lacksEnterpriseProperties (engine, purpose, properties, output, contactUs) {
    if (properties.some((name) => this.hasProperty(engine, name))) {
      return false;
    }
    const names = properties.length === 1
      ? `the ${properties[0]} property`
      : `the ${properties.slice(0, -1).join(', ')} and ` +
        `${properties[properties.length - 1]} properties`;
    output.write(`${purpose} needs ${names}, which only the Enterprise ` +
      'data file has. The data file in use does not have ' +
      `${properties.length === 1 ? 'it' : 'them'}, so the example stops ` +
      'here. Contact us for a copy of the Enterprise data file at ' +
      `${contactUs}\n`);
    return true;
  }

  // What the Enterprise data file adds and where to ask for a copy, written
  // after an example that shows no location properties has run on a free
  // data file.
  static getEnterpriseOffer (contactUs) {
    return 'This example used a free data file. The Enterprise data file ' +
      'adds the location, range and connection properties. Contact us for ' +
      `a copy at ${contactUs}`;
  }

  static sortMap (map, sortFunc) {
    const tupleArray = [];
    map.forEach((value, key, map) => { tupleArray.push([key, value]); });
    tupleArray.sort(sortFunc);
    return new Map(tupleArray);
  }

  // Get the value of a property as a single value, or the supplied
  // default where no value is available. Most IP intelligence values are
  // lists of weighted values, in which case the value with the highest
  // weight is returned.
  static getSingleValue (elementData, propertyName, defaultValue) {
    let property;
    try {
      property = elementData[propertyName];
    } catch (e) {
      return defaultValue;
    }
    if (property === undefined ||
      property === null ||
      property.hasValue === false) {
      return defaultValue;
    }
    let value = property.value;
    if (Array.isArray(value)) {
      let best;
      for (const item of value) {
        if (best === undefined || item.weight > best.weight) {
          best = item;
        }
      }
      value = best !== undefined && best.value !== undefined
        ? best.value
        : best;
    } else if (value !== null &&
      typeof value === 'object' &&
      value.value !== undefined) {
      value = value.value;
    }
    return value === undefined || value === null ? defaultValue : value;
  }
}

module.exports = {
  ExampleUtils,
  NEEDS_ENTERPRISE,
  DATA_FILE_AGE_WARNING,
  IPI_DATA_FILE_ENV_VAR,
  DD_DATA_FILE_ENV_VAR,
  DEPRECATED_IPI_DATA_FILE_ENV_VAR,
  DEPRECATED_DD_DATA_FILE_ENV_VAR
};
