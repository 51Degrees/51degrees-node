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

module.exports = {
  /**
   * Get a key value from the environment, trying both the
   * supplied name and the upper-case form.
   *
   * @param {string} keyName name of the environment variable
   * @returns {string} the value of the environment variable
   */
  getNamedKey: function (keyName) {
    let value = process.env[keyName];
    if (!value) {
      value = process.env[keyName.toUpperCase()];
    }
    return value;
  },

  /**
   * Check if a key is invalid. Keys are base64 encoded and must
   * be of a minimum length.
   *
   * @param {string} keyValue value of the key to check
   * @returns {boolean} true if the key is invalid
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
