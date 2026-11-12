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

const testConstants = require('./testConstants');

// Placeholder written into example configuration files, which stands for
// 'no key has been set here'.
const PLACEHOLDER = '!!YOUR_RESOURCE_KEY!!';

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
 * Helpers to obtain keys from the environment
 */
module.exports = {
  /**
   * Obtain a key either from environment variable or from a property.
   * Try resource key as env var, then as upper case env var, the system property
   *
   * @param {string} keyName Name of the key
   * @returns {string} Key value
   */
  getNamedKey: function (keyName) {
    let value = process.env[keyName];
    if (!value) {
      value = process.env[keyName.toUpperCase()];
    }
    return value;
  },

  /**
   * Obtain a resource key from the environment. The name is read first.
   * When it is unset or empty, the deprecated name it replaced is read,
   * as testConstants.legacyEnvVars gives it.
   *
   * @param {string} envVarName One of testConstants.envVars
   * @returns {string} The key, or undefined when neither name is set
   */
  getResourceKey: function (envVarName) {
    const value = process.env[envVarName];

    if (value && value !== PLACEHOLDER) {
      return value;
    }

    const oldName = testConstants.legacyEnvVars[envVarName];
    const oldValue = oldName ? process.env[oldName] : undefined;

    if (oldValue && oldValue !== PLACEHOLDER) {
      reportOldName(oldName, envVarName);
      return oldValue;
    }

    return undefined;
  },

  /**
   * The message to show when a resource key is missing, naming the
   * variable that was wanted rather than leaving the reader to guess.
   *
   * @param {string} envVarName One of testConstants.envVars
   * @returns {string} The message
   */
  missingResourceKeyMessage: function (envVarName) {
    return 'No resource key found. Set the environment variable ' +
      `'${envVarName}'. Create a resource key for free at ` +
      'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.shared-tests-keyutils.js&utm_term=resource-key-required';
  },

  /**
   * Evaluate whether a key might be valid
   *
   * @param {string} keyValue Value to test
   * @returns {boolean} Is invalid key
   */
  isInvalidKey: function (keyValue) {
    try {
      const buff = Buffer.from(keyValue, 'base64');
      const decoded = buff.toString('ascii');
      return !keyValue ||
        keyValue.trim().length < 19 ||
        decoded.length < 14;
    } catch (e) {
      return true;
    }
  }
};
