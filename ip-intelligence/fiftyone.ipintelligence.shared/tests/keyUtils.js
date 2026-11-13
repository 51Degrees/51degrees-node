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

// The deprecated names each name replaced, in the order to try them. They
// are read only when every name a test asks for is unset or empty.
const DEPRECATED_NAMES = {
  _51DEGREES_RESOURCE_KEY: ['51DEGREES_RESOURCE_KEY', 'RESOURCE_KEY'],
  _51DEGREES_RESOURCE_KEY_SUPER: ['TEST_SUPER_RESOURCE_KEY']
};

/**
 * The name that replaced a deprecated name.
 *
 * @param {string} oldName an environment variable name
 * @returns {string|undefined} the name that replaced it, or undefined when
 * the name is not a deprecated one
 */
const replacementOf = function (oldName) {
  return Object.keys(DEPRECATED_NAMES).find(
    (name) => DEPRECATED_NAMES[name].includes(oldName));
};

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

// Where to see the products a resource key carries.
const ACCESSIBLE_PROPERTIES_URL =
  'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>';

// Where to create a resource key.
const CONFIGURE_URL = 'https://51degrees.com/configure?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.shared-tests-keyutils.js&utm_term=resource-key-required';

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
   * from, in order. The two shared names come first, then any name the
   * test takes its own key from. The deprecated names those names replaced
   * come last, so each is read only when the names before it are unset or
   * empty.
   *
   * @param {...string} extraNames further names, in the order to try
   * @returns {Array<string>} the names to try, in order
   */
  resourceKeyNames: function (...extraNames) {
    const names = SHARED_RESOURCE_KEY_NAMES.concat(extraNames);
    const oldNames = names.flatMap((name) => DEPRECATED_NAMES[name] || []);
    return names.concat(oldNames)
      .filter((name, index, all) => all.indexOf(name) === index);
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
        if (replacementOf(name)) {
          reportOldName(name, replacementOf(name));
        }
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
    const current = names.filter((name) => !replacementOf(name));
    return `${start} a resource key and there is nothing to fall back on. ` +
      `None of ${current.join(', ')} is set, tried in that order. The key ` +
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
