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

// A configuration file gives a list of strings as one comma separated
// string (pipeline-configuration.md lines 50 to 62), so a setting that holds
// a list reads that form as well as a list.

const { listSetting } = require('fiftyone.pipeline.core');

describe('a list setting', () => {
  test('given as one comma separated string is split into its items', () => {
    expect(listSetting('IsMobile, BrowserName,PlatformName'))
      .toEqual(['IsMobile', 'BrowserName', 'PlatformName']);
  });

  test('given as one string with no comma is a list of that string', () => {
    expect(listSetting('IsMobile')).toEqual(['IsMobile']);
  });

  test('leaves out empty items and the space around each item', () => {
    expect(listSetting(' a ,, b ,')).toEqual(['a', 'b']);
  });

  // An empty string in a configuration file means the setting is not set,
  // because an empty list restricts an engine to no properties.
  test('given as a string with no items is not set', () => {
    expect(listSetting('')).toBeUndefined();
    expect(listSetting(' , ')).toBeUndefined();
  });

  test('given as a list is that list', () => {
    const list = ['IsMobile', 'BrowserName'];
    expect(listSetting(list)).toBe(list);
  });

  test('that is not set stays not set', () => {
    expect(listSetting(undefined)).toBeUndefined();
    expect(listSetting(null)).toBeNull();
  });
});
