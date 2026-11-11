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

/**
 * The index of each property the engine was built with, keyed by its name in
 * lower case. A property's index is its place in the list of names given at
 * build, which the native code uses too, so the same index names the same
 * property whatever order a reloaded data set holds. The table is never
 * built from the data set.
 *
 * Where a name is given twice the first place is kept, as the native code
 * does.
 *
 * @param {Array<string>} names the property names the engine was built with
 * @returns {object} the index of each name, keyed by the name in lower case
 */
const fromNames = function (names) {
  const indexes = {};

  if (!names) {
    return indexes;
  }

  names.forEach(function (name, index) {
    const key = name.toLowerCase();
    if (indexes[key] === undefined) {
      indexes[key] = index;
    }
  });

  return indexes;
};

module.exports = { fromNames };
