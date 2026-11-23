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

module.exports = {
  /**
   * Helper to convert a swig vector into a standard JavaScript array
   *
   * @param {object} vector vector object form swig
   * @returns {Array} converted array
   */
  vectorToArray: function (vector) {
    const output = [];

    for (let i = 0; i < vector.size(); i++) {
      output.push(vector.get(i));
    }

    return output;
  },

  /**
   * Helper to convert a Swig date to a JavaScript one, at midnight UTC
   *
   * @param {object} swigDate date
   * @returns {Date} converted date object
   */
  swigDateToDate: function (swigDate) {
    // The engine reports whole days, so the date is midnight UTC on that
    // day and does not depend on when it is converted. Months start at 1.
    const date = new Date(0);
    const month = swigDate.getMonth();
    const day = swigDate.getDay();

    date.setUTCFullYear(
      swigDate.getYear(),
      month > 0 ? month - 1 : 0,
      day > 0 ? day : 1);

    return date;
  }
};
