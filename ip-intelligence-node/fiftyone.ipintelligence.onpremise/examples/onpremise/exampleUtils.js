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

const swigHelpers = require(path.join(__dirname, '/../../swigHelpers'));

// Timeout used when searching for file
const FIND_FILE_TIMEOUT_MS = 10000;

// If data file is older than this number of days then a warning will
// be displayed.
const DATA_FILE_AGE_WARNING = 30;

// Environment variable that can be set to supply an explicit path to
// the IP intelligence data file. Checked before the folder hierarchy
// is searched.
const IPI_DATA_FILE_ENV_VAR = '51DEGREES_IPI_PATH';

// Environment variable that can be set to supply an explicit path to
// the device detection data file used by the mixed examples. Checked
// before the folder hierarchy is searched.
const DD_DATA_FILE_ENV_VAR = '51DEGREES_DD_PATH';

// Content types for the small set of static assets served by the web
// examples. The shared pattern-library CSS and JS live under each
// example's 'public' directory.
const STATIC_CONTENT_TYPES = {
  '.css': 'text/css',
  '.js': 'text/javascript'
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

  // Find the specified filename within the default lookup directory.
  static findFile (fileName) {
    return this.privateFindFile(
      fileName,
      new Date().getTime() + FIND_FILE_TIMEOUT_MS,
      path.normalize(process.cwd()));
  }

  // Get the path to an IP intelligence data file. The environment
  // variable named by IPI_DATA_FILE_ENV_VAR is checked first for an
  // explicit path. If it is not set then the folder hierarchy is
  // searched for the supplied file name.
  static findDataFile (fileName) {
    return process.env[IPI_DATA_FILE_ENV_VAR] || this.findFile(fileName);
  }

  // Get the path to a device detection data file. The environment
  // variable named by DD_DATA_FILE_ENV_VAR is checked first for an
  // explicit path. If it is not set then the folder hierarchy is
  // searched for the supplied file name.
  static findDeviceDataFile (fileName) {
    return process.env[DD_DATA_FILE_ENV_VAR] || this.findFile(fileName);
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

    if (new Date().getTime() > new Date(dateTime + DATA_FILE_AGE_WARNING).getTime()) {
      console.warn('This example is using a data file ' +
        `that is more than ${DATA_FILE_AGE_WARNING} days old. ` +
        'A more recent data file may be needed to ' +
        'correctly determine the details of the latest ' +
        'IP ranges. The latest lite data file is available ' +
        'from the ip-intelligence-data repository on GitHub ' +
        'https://github.com/51Degrees/ip-intelligence-data. ' +
        'Find out about the Enterprise data file, which ' +
        'includes automatic daily updates, on our pricing ' +
        'page: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-exampleutils.js&utm_term=data-file-age-warning');
    }
    if (dataTier === 'Lite') {
      console.warn('This example is using the \'Lite\' ' +
        'data file. This is used for illustration, and ' +
        'has limited accuracy and capabilities. Find ' +
        'out about the Enterprise data file on our ' +
        'pricing page: https://51degrees.com/pricing?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-examples-onpremise-exampleutils.js&utm_term=lite-data-file');
    }
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
  DATA_FILE_AGE_WARNING,
  IPI_DATA_FILE_ENV_VAR,
  DD_DATA_FILE_ENV_VAR
};
