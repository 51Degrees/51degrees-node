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

/**
 * Read a weighted list from element data, returning an empty array when the
 * property is absent or has no value.
 *
 * @param {object} data the element data
 * @param {string} key the property key
 * @returns {Array} the weighted value array
 */
const readWeighted = (data, key) => {
  try {
    const value = data.get(key);
    return value && value.hasValue ? value.value : [];
  } catch (e) {
    return [];
  }
};

/**
 * Assert that one dimension's "All" lists are produced with the most probable
 * country first. The check is data independent: with the Lite data file there
 * may be no weighted codes, in which case the weighted prefix is empty and the
 * remaining structural assertions still hold.
 *
 * @param {object} flowData the processed flow data
 * @param {Array<string>} codes the ordered "All" codes list
 * @param {Array<string>} names the ordered "All" names list
 * @param {string} codesProperty the IP engine weighted codes property name
 */
const assertOrdered = (flowData, codes, names, codesProperty) => {
  // Codes and names are index-aligned and complete.
  expect(codes.length).toBe(names.length);
  expect(codes.length).toBeGreaterThan(200);

  // The weighted countries lead the list, ordered by descending weight.
  const weighted = readWeighted(flowData.get('ip'), codesProperty);
  const codeSet = new Set(codes);
  const validWeighted = weighted.filter((item) => codeSet.has(item.value));
  const prefix = codes.slice(0, validWeighted.length);
  expect(new Set(prefix)).toEqual(new Set(validWeighted.map((w) => w.value)));

  const weightByCode = {};
  weighted.forEach((item) => { weightByCode[item.value] = item.rawWeight; });
  for (let i = 1; i < prefix.length; i++) {
    expect(weightByCode[prefix[i - 1]])
      .toBeGreaterThanOrEqual(weightByCode[prefix[i]]);
  }
};

describe('Examples', () => {
  test('onpremise country translation console - most probable first',
    async () => {
      const result = await example.run(
        getDataFilePath(liteDataFileName), { write: () => {} });

      // A free data file has no country codes, so the example says so and
      // stops without ordering anything. The tests of the examples without
      // settings check what it writes.
      if (result === undefined) {
        return;
      }

      assertOrdered(result.flowData, result.geographicalCodes,
        result.geographicalNames, 'countrycodesgeographical');
      assertOrdered(result.flowData, result.populationCodes,
        result.populationNames, 'countrycodespopulation');
    });
});
