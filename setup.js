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

// IP intelligence data files are large so engine initialisation can
// take longer than the jest default of 5 seconds.
jest.setTimeout(60000); // in milliseconds

// Each on-premise engine holds gigabytes of native memory that V8 does
// not account for, so the garbage collector never runs on its own and
// engines from completed suites stay resident until the process dies.
// When jest runs in band with node --expose-gc, collecting at the start
// of each suite frees the previous suite's engines and keeps the peak
// at one suite's worth of engines.
beforeAll(() => {
  if (global.gc) {
    global.gc();
  }
});
