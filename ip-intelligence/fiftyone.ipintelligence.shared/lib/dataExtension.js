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

class DataExtension {
  /**
   * Format a single value for human-readable output. Weighted values
   * (objects with 'value' and 'weight' entries) are formatted as
   * 'value' when the weight is 1, or 'value (xx.xx%)' otherwise.
   *
   * @param {*} item value to format
   * @returns {string} human readable form of the value
   */
  static formatValue (item) {
    if (item !== null &&
      typeof item === 'object' &&
      item.value !== undefined) {
      const weight = item.weight;
      if (weight !== undefined && Math.abs(weight - 1) > 0.0001) {
        return `${item.value} (${(weight * 100).toFixed(2)}%)`;
      }
      return `${item.value}`;
    }
    return `${item}`;
  }

  /**
   * Helper to get a human readable value of an aspect property value.
   * IP intelligence values are commonly lists of weighted values, which
   * are formatted as a comma separated list with weights where the
   * weight is not 1.
   *
   * @param {object} elementData the element data from a flow data
   * @param {string} propertyName name of the property to get
   * @returns {string} human readable value of the property
   */
  static getValueHelper (elementData, propertyName) {
    try {
      const property = elementData[propertyName];
      if (property && property.hasValue) {
        if (Array.isArray(property.value)) {
          return property.value
            .map(item => DataExtension.formatValue(item))
            .join(', ');
        } else {
          return DataExtension.formatValue(property.value);
        }
      } else {
        return `Unknown (${property.noValueMessage})`;
      }
    } catch (e) {
      return `Unknown (${e})`;
    }
  };
}

module.exports = DataExtension;
