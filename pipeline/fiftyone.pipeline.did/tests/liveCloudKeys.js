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

// Where the tests that call the live 51Degrees cloud service read their
// keys from, and what they fail with when a key or the answer lacks what
// they need. There is no fallback to a skip, because a cloud test that
// passes without calling the cloud has proved nothing.

// Where to see the products a resource key carries.
const ACCESSIBLE_PROPERTIES_URL =
  'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>';

// Where to create a resource key.
const CONFIGURE_URL = 'https://51degrees.com/configure?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.did-tests-livecloudkeys.js&utm_term=resource-key-required';

// The resource keys the live tests run with, each read under its own name,
// and the license that redeems with it. A license redeems only within the
// account of its resource key, so each is paired by name. A key with no
// license redeems unlicensed. _51DEGREES_LICENSE_KEY is the license for data
// file downloads, which redeems nothing, so it is not read.
const KEY_PAIRS = [
  { resourceKey: '_51DEGREES_RESOURCE_KEY_BESPOKE', licenceKey: null },
  {
    resourceKey: '_51DEGREES_RESOURCE_KEY_51DID',
    licenceKey: '_51DEGREES_LICENSE_KEY_51DID'
  }
];

/**
 * The value set under the given name.
 *
 * @param {string} name the environment variable name
 * @returns {string} the value, or an empty string when it is not set
 */
const findKey = function (name) {
  const value = name ? process.env[name] : '';
  return value && value.trim() ? value.trim() : '';
};

module.exports = {
  KEY_PAIRS,

  findKey,

  /**
   * The keys to run the live tests with, one entry for each resource key
   * that is set.
   *
   * @returns {Array<{name: string, resourceKey: string, licenceKey: string}>}
   * the name of each resource key, its value and its license, which is an
   * empty string when there is none
   */
  runs: function () {
    return KEY_PAIRS
      .map((pair) => ({
        name: pair.resourceKey,
        resourceKey: findKey(pair.resourceKey),
        licenceKey: findKey(pair.licenceKey)
      }))
      .filter((run) => run.resourceKey);
  },

  /**
   * The names of the licenses that are set while their resource key is
   * not, so the licensed redeem would not run.
   *
   * @returns {Array<string>} the license names
   */
  unpairedLicences: function () {
    return KEY_PAIRS
      .filter((pair) => findKey(pair.licenceKey) &&
        !findKey(pair.resourceKey))
      .map((pair) => pair.licenceKey);
  },

  /**
   * The message a cloud test fails with when no resource key is set.
   *
   * @param {Array<string>} names the environment variable names read
   * @param {string} product the product the key has to carry
   * @param {string} asksFor what the tests ask the cloud service for
   * @param {boolean} [plural] true for a group of tests
   * @returns {string} the message
   */
  noKeyMessage: function (names, product, asksFor, plural) {
    const start = plural
      ? 'These tests call the live 51Degrees cloud service, so they need'
      : 'This test calls the live 51Degrees cloud service, so it needs';
    const asker = plural ? 'the tests ask' : 'the test asks';
    const unset = names.length > 1
      ? `None of ${names.join(', ')} is set.`
      : `${names[0]} is not set.`;
    return `${start} a resource key and there is nothing to fall back on. ` +
      `${unset} The key ` +
      `has to carry the ${product} product, because ${asker} the service ` +
      `for ${asksFor}. To see the products a key carries, open ` +
      `${ACCESSIBLE_PROPERTIES_URL}. Create a key at ${CONFIGURE_URL}.`;
  },

  /**
   * The message for an answer from the cloud that lacks something a test
   * needs, naming the product a key needs to get it.
   *
   * @param {string} thing what the answer lacks
   * @param {string} reason the cloud's nullreason, if it gave one
   * @param {string} product the product a key needs for the thing
   * @returns {string} the message
   */
  missingMessage: function (thing, reason, product) {
    return `The cloud answered without ${thing} ` +
      `(${reason || 'no reason given'}), which is what a key that does ` +
      `not carry the ${product} product gets.`;
  }
};
