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
// resource key from, and what they fail with when the key or the answer
// lacks what they need. There is no fallback to a skip, because a cloud
// test that passes without calling the cloud has proved nothing.

// Where to see the products a resource key carries.
const ACCESSIBLE_PROPERTIES_URL =
  'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>';

// Where to create a resource key.
const CONFIGURE_URL = 'https://configure.51degrees.com?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.did-tests-livecloudkeys.js&utm_term=resource-key-required';

module.exports = {
  // The names the resource key is read from, in order. The workflow that
  // runs the tests once for each key sets _51DEGREES_RESOURCE_KEY to each
  // in turn, so it comes first.
  RESOURCE_KEY_NAMES: [
    '_51DEGREES_RESOURCE_KEY',
    '_51DEGREES_RESOURCE_KEY_BESPOKE'
  ],

  /**
   * The first value set under the given names.
   *
   * @param {Array<string>} names the environment variable names, in order
   * @returns {string} the value, or an empty string when none is set
   */
  findKey: function (names) {
    for (const name of names) {
      const value = process.env[name];
      if (value && value.trim()) {
        return value.trim();
      }
    }
    return '';
  },

  /**
   * The message a cloud test fails with when no resource key is set.
   *
   * @param {Array<string>} names the environment variable names tried
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
    return `${start} a resource key and there is nothing to fall back on. ` +
      `None of ${names.join(', ')} is set, tried in that order. The key ` +
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
