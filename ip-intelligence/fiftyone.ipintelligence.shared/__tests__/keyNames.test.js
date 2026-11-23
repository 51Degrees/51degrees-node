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

// The name the cloud tests read their resource key from, and the helpers
// that read it. The key has one name.

const { testConstants, keyUtils } = require('../index');

const NAME = '_51DEGREES_TEST_KEY_NAME';

describe('key names', () => {
  afterEach(() => {
    delete process.env[NAME];
  });

  test('the tests read one resource key', () => {
    expect(testConstants.envVars).toEqual({
      resourceKeyBespokeVariable: '_51DEGREES_RESOURCE_KEY_BESPOKE'
    });
  });

  test('the helpers read a key under the name given and no other', () => {
    expect(Object.keys(keyUtils).sort()).toEqual([
      'getResourceKey', 'isInvalidKey', 'missingFromAnswerMessage',
      'missingResourceKeyMessage', 'requireProduct'
    ]);
    expect(keyUtils.getResourceKey(NAME)).toBeUndefined();
    process.env[NAME] = ' a-key ';
    expect(keyUtils.getResourceKey(NAME)).toBe('a-key');
    const message = keyUtils.missingResourceKeyMessage(NAME, 'ip',
      'the properties of an IP address');
    expect(message).toContain(`${NAME} is not set.`);
    expect(message).toContain('the ip product');
  });
});
