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

// The names every cloud test reads its resource key from first, in order.
const SHARED_RESOURCE_KEY_NAMES = [
  '_51DEGREES_RESOURCE_KEY',
  '_51DEGREES_RESOURCE_KEY_BESPOKE'
];

// Where to see the products a resource key carries.
const ACCESSIBLE_PROPERTIES_URL =
  'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>';

// Where to create a resource key.
const CONFIGURE_URL = 'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.shared-tests-keyutils.js&utm_term=resource-key-required';

/**
 * The message for an answer from the cloud that lacks something a test
 * needs, naming the product a key needs to get it.
 *
 * @param {string} thing what the answer lacks
 * @param {string} reason the cloud's nullreason, if it gave one
 * @param {string} product the product a key needs for the thing
 * @returns {string} the message
 */
const missingFromAnswerMessage = function (thing, reason, product) {
  return `The cloud answered without ${thing} ` +
    `(${reason || 'no reason given'}), which is what a key that does not ` +
    `carry the ${product} product gets.`;
};

module.exports = {
  /**
   * The environment variable names a cloud test reads its resource key
   * from, in order. The two shared names come first, then the names the
   * test read before them.
   *
   * @param {...string} legacyNames the older names, in the order to try
   * @returns {Array<string>} the names to try, in order
   */
  resourceKeyNames: function (...legacyNames) {
    return SHARED_RESOURCE_KEY_NAMES.concat(legacyNames)
      .filter((name, index, names) => names.indexOf(name) === index);
  },

  /**
   * The first resource key set under the given names.
   *
   * @param {Array<string>} names the environment variable names, in order
   * @returns {string} the key, or undefined when none of them is set
   */
  getResourceKey: function (names) {
    for (const name of names) {
      const value = process.env[name];
      if (value && value.trim() && value !== PLACEHOLDER) {
        return value.trim();
      }
    }
    return undefined;
  },

  /**
   * The message a cloud test fails with when no resource key is set.
   *
   * @param {Array<string>} names the environment variable names tried
   * @param {string|Array<string>} products the products the key has to
   * carry
   * @param {string} asksFor what the test asks the cloud service for
   * @param {boolean} [plural] true for a group of tests
   * @returns {string} the message
   */
  missingResourceKeyMessage: function (names, products, asksFor, plural) {
    const start = plural
      ? 'These tests call the live 51Degrees cloud service, so they need'
      : 'This test calls the live 51Degrees cloud service, so it needs';
    const asker = plural ? 'the tests ask' : 'the test asks';
    const list = [].concat(products);
    const carried = list.join(' and ') +
      (list.length > 1 ? ' products' : ' product');
    return `${start} a resource key and there is nothing to fall back on. ` +
      `None of ${names.join(', ')} is set, tried in that order. The key ` +
      `has to carry the ${carried}, because ${asker} the service ` +
      `for ${asksFor}. To see the products a key carries, open ` +
      `${ACCESSIBLE_PROPERTIES_URL}. Create a key at ${CONFIGURE_URL}.`;
  },

  missingFromAnswerMessage,

  /**
   * Fails when the resource key of a cloud request engine does not carry
   * a product, so that a test says so rather than failing on whatever the
   * missing product breaks first.
   *
   * @param {object} cloudRequestEngine the engine holding the key
   * @param {string} product the product the key has to carry
   * @returns {Promise<void>} resolves when the key carries the product
   */
  requireProduct: async function (cloudRequestEngine, product) {
    await cloudRequestEngine.ready();
    const products = Object.keys(
      cloudRequestEngine.flowElementProperties || {});
    if (!products.some(
      (name) => name.toLowerCase() === product.toLowerCase())) {
      throw new Error(missingFromAnswerMessage(
        `the ${product} properties`, undefined, product));
    }
  },

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
