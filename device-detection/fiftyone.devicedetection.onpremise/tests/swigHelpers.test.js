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

// The dates the native engine reports are whole days, so the converted date
// must not carry the time of day it was converted at.

const path = require('path');
const swigHelpers = require(path.resolve(__dirname, '..', 'swigHelpers'));

const swigDate = (year, month, day) => ({
  getYear: () => year,
  getMonth: () => month,
  getDay: () => day
});

describe('swigDateToDate', () => {
  test('is midnight UTC on the day given', () => {
    const date = swigHelpers.swigDateToDate(swigDate(2026, 3, 9));
    expect(date.toISOString()).toBe('2026-03-09T00:00:00.000Z');
  });

  test('gives the same date whenever it is called', () => {
    const first = swigHelpers.swigDateToDate(swigDate(2026, 1, 31));
    const second = swigHelpers.swigDateToDate(swigDate(2026, 1, 31));
    expect(first.getTime()).toBe(second.getTime());
    expect(first.toISOString()).toBe('2026-01-31T00:00:00.000Z');
  });

  test('a date that is not set is not in the present', () => {
    const date = swigHelpers.swigDateToDate(swigDate(0, 0, 0));
    expect(date.getTime()).toBeLessThanOrEqual(0);
  });
});
