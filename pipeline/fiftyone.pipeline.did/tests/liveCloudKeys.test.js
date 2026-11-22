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

// The keys the live tests run with. Each resource key is read under its own
// name, and a license redeems only within the account of the resource key
// it is paired with. _51DEGREES_LICENSE_KEY holds the license for data file
// downloads, which redeems nothing, so it is never read here.

const keys = require('./liveCloudKeys');

const NAMES = [
  '_51DEGREES_RESOURCE_KEY_BESPOKE',
  '_51DEGREES_RESOURCE_KEY_51DID',
  '_51DEGREES_LICENSE_KEY_51DID',
  '_51DEGREES_LICENSE_KEY'
];

describe('liveCloudKeys', () => {
  let saved;

  beforeEach(() => {
    saved = NAMES.map((name) => [name, process.env[name]]);
    for (const name of NAMES) {
      delete process.env[name];
    }
  });

  afterEach(() => {
    for (const [name, value] of saved) {
      if (value === undefined) {
        delete process.env[name];
      } else {
        process.env[name] = value;
      }
    }
  });

  test('pairs each resource key with the license of its account', () => {
    expect(keys.KEY_PAIRS).toEqual([
      { resourceKey: '_51DEGREES_RESOURCE_KEY_BESPOKE', licenceKey: null },
      {
        resourceKey: '_51DEGREES_RESOURCE_KEY_51DID',
        licenceKey: '_51DEGREES_LICENSE_KEY_51DID'
      }
    ]);
  });

  test('runs once for each resource key that is set', () => {
    expect(keys.runs()).toEqual([]);
    process.env._51DEGREES_RESOURCE_KEY_51DID = ' did-key ';
    process.env._51DEGREES_LICENSE_KEY_51DID = 'did-license';
    expect(keys.runs()).toEqual([{
      name: '_51DEGREES_RESOURCE_KEY_51DID',
      resourceKey: 'did-key',
      licenceKey: 'did-license'
    }]);
    process.env._51DEGREES_RESOURCE_KEY_BESPOKE = 'bespoke-key';
    expect(keys.runs()).toEqual([{
      name: '_51DEGREES_RESOURCE_KEY_BESPOKE',
      resourceKey: 'bespoke-key',
      licenceKey: ''
    }, {
      name: '_51DEGREES_RESOURCE_KEY_51DID',
      resourceKey: 'did-key',
      licenceKey: 'did-license'
    }]);
  });

  test('finds no license when only the data license is set', () => {
    process.env._51DEGREES_LICENSE_KEY = 'data-license';
    process.env._51DEGREES_RESOURCE_KEY_51DID = 'did-key';
    expect(keys.runs().map((run) => run.licenceKey)).toEqual(['']);
  });

  test('names a license whose resource key is not set', () => {
    expect(keys.unpairedLicences()).toEqual([]);
    process.env._51DEGREES_LICENSE_KEY_51DID = 'did-license';
    expect(keys.unpairedLicences()).toEqual(['_51DEGREES_LICENSE_KEY_51DID']);
    process.env._51DEGREES_RESOURCE_KEY_51DID = 'did-key';
    expect(keys.unpairedLicences()).toEqual([]);
  });

  test('the message names every key that is not set', () => {
    expect(keys.noKeyMessage(['_51DEGREES_A'], 'FODid', 'a 51Did'))
      .toContain('_51DEGREES_A is not set.');
    expect(keys.noKeyMessage(['_51DEGREES_A', '_51DEGREES_B'], 'FODid',
      'a 51Did')).toContain('None of _51DEGREES_A, _51DEGREES_B is set.');
  });
});
