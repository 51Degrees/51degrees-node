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

const path = require('path');
const {
  liteDataFileName, getDataFilePath
} = require(path.join(__dirname, '/../../../tests/testHelper'));

const example = require(path.join(__dirname, '/gettingStarted.js'));

// A line giving a value of Registered Country with its weighting, which
// ip-intelligence required-examples.md lines 107 and 108 ask an example to
// show, 1 for a single answer.
const WEIGHTING = /^\tRegistered Country: [A-Z]{2}, weighting (1|0\.\d+)$/m;

describe('Examples', () => {
  test('onpremise getting started Lite data file', async () => {
    let written = '';
    await example.run(getDataFilePath(liteDataFileName), {
      write: (text) => { written += text; }
    });
    expect(written).toMatch(WEIGHTING);
  });
});
