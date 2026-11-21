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

// The names the live tests read their keys from. The license redeems only
// within the account of the resource key it is paired with, so it is read
// only under the 51Did license name. _51DEGREES_LICENSE_KEY holds the
// license for data file downloads, which CI sets for every job, and a
// redeem with it would fail rather than skip.

const keys = require('./liveCloudKeys');

describe('liveCloudKeys', () => {
  test('reads the license only under the 51Did license name', () => {
    expect(keys.LICENCE_KEY_NAMES).toEqual(['_51DEGREES_LICENSE_KEY_51DID']);
  });

  test('finds no license when only the data license is set', () => {
    const saved = {
      data: process.env._51DEGREES_LICENSE_KEY,
      did: process.env._51DEGREES_LICENSE_KEY_51DID
    };
    process.env._51DEGREES_LICENSE_KEY = 'data-license';
    delete process.env._51DEGREES_LICENSE_KEY_51DID;
    try {
      expect(keys.findKey(keys.LICENCE_KEY_NAMES)).toBe('');
    } finally {
      for (const [name, value] of [
        ['_51DEGREES_LICENSE_KEY', saved.data],
        ['_51DEGREES_LICENSE_KEY_51DID', saved.did]]) {
        if (value === undefined) {
          delete process.env[name];
        } else {
          process.env[name] = value;
        }
      }
    }
  });
});
