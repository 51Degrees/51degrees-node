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

// Placeholder written into example configuration files, which stands for
// 'no key has been set here'.
const PLACEHOLDER = '!!YOUR_RESOURCE_KEY!!';

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
   * Obtain a resource key from the environment, read under the one name
   * that variable has.
   *
   * @param {string} envVarName One of testConstants.envVars
   * @returns {string} The key, or undefined when the name is not set
   */
  getResourceKey: function (envVarName) {
    const value = process.env[envVarName];

    if (value && value !== PLACEHOLDER) {
      return value;
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
      'https://51degrees.com/configure?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.devicedetection.shared-tests-keyutils.js&utm_term=resource-key-required';
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
