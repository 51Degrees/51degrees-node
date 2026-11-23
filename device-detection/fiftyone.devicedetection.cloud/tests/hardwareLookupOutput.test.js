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

// The check the live tests of the hardware lookup examples make of what the
// example printed, run here on printed text so that it is tested without a
// resource key.

const {
  checkHardwareLookupOutput,
  hasVendorAndModel
} = require('./hardwareLookupOutput');

const LOOKUP = {
  keyName: '_51DEGREES_RESOURCE_KEY_BESPOKE',
  name: 'TAC lookup',
  subject: 'TAC',
  values: ['35925406', '86386802']
};

const printed = (first, second) => [
  'Intro',
  "Which devices are associated with the TAC '35925406'?",
  first,
  "Which devices are associated with the TAC '86386802'?",
  second,
  ''
].join('\n');

describe('hardware lookup output', () => {
  test('passes when each value lists a device with a vendor and model',
    () => {
      expect(() => checkHardwareLookupOutput(printed(
        '\tApple iPhone 6 (A1586)',
        '\tSamsung Unknown (no value) (SM-G900F)'), LOOKUP)).not.toThrow();
    });

  test('fails naming the property when the key has no hardware lookup',
    () => {
      const text = 'The resource key does not include ' +
        'HardwarePlatform.Profiles, the hardware lookup this example needs.';
      expect(() => checkHardwareLookupOutput(text, LOOKUP)).toThrow(
        'The resource key in _51DEGREES_RESOURCE_KEY_BESPOKE does not ' +
        'include HardwarePlatform.Profiles, which the TAC lookup needs.\n' +
        text);
    });

  test('fails naming the value when it lists no device', () => {
    expect(() => checkHardwareLookupOutput(printed(
      '\tApple iPhone 6 (A1586)',
      '\tNo devices are associated with this TAC.'), LOOKUP)).toThrow(
      "No device with a vendor and a model was listed for the TAC '86386802'.");
  });

  test('fails when a heading is missing', () => {
    expect(() => checkHardwareLookupOutput(
      "Which devices are associated with the TAC '35925406'?\n" +
      '\tApple iPhone 6 (A1586)\n', LOOKUP)).toThrow("TAC '86386802'");
  });

  test('a line without a vendor or a model does not count', () => {
    expect(hasVendorAndModel('Apple iPhone 6 (A1586)')).toBe(true);
    expect(hasVendorAndModel('Unknown (no value) iPhone 6 (A1586)'))
      .toBe(false);
    expect(hasVendorAndModel('Apple iPhone 6 (Unknown (no value))'))
      .toBe(false);
    expect(hasVendorAndModel('Apple iPhone 6 ()')).toBe(false);
    expect(hasVendorAndModel('Apple (A1586)')).toBe(false);
    expect(hasVendorAndModel('Apple iPhone 6 (null)')).toBe(false);
    expect(hasVendorAndModel('Apple iPhone 6 (undefined)')).toBe(false);
    expect(hasVendorAndModel('null iPhone 6 (A1586)')).toBe(false);
    expect(hasVendorAndModel('undefined iPhone 6 (A1586)')).toBe(false);
    expect(hasVendorAndModel('Apple null (A1586)')).toBe(true);
    expect(hasVendorAndModel('No devices are associated with this TAC.'))
      .toBe(false);
  });
});
