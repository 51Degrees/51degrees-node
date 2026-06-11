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

class ExampleUtils {
  // Find the specified filename within the default lookup directory.
  static findFile (fileName) {
    return this.privateFindFile(
      fileName,
      new Date().getTime() + FIND_FILE_TIMEOUT_MS,
      path.normalize(process.cwd()));
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
        'page: https://51degrees.com/pricing');
    }
    if (dataTier === 'Lite') {
      console.warn('This example is using the \'Lite\' ' +
        'data file. This is used for illustration, and ' +
        'has limited accuracy and capabilities. Find ' +
        'out about the Enterprise data file on our ' +
        'pricing page: https://51degrees.com/pricing');
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
  DATA_FILE_AGE_WARNING
};
