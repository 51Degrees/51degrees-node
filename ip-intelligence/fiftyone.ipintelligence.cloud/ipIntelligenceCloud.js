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
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */

const CloudEngine = require('fiftyone.pipeline.cloudrequestengine').CloudEngine;

// The raw weighting that stands for a weight of 1.
const RAW_WEIGHTING_MAX = 65535;

/**
 * A WKT value the service writes as an object with one member, value,
 * holding the WKT text, read as that text. Any other value is returned as
 * it is.
 *
 * @param {*} value the value the service sent
 * @returns {*} the WKT text, or the value
 */
const wktText = function (value) {
  return value !== null && typeof value === 'object' &&
    Array.isArray(value) === false && Object.keys(value).length === 1 &&
    typeof value.value === 'string'
    ? value.value
    : value;
};

/**
 * Whether an item of a list is a weighted value as the service sends one,
 * with a rawweighting member and a value member.
 *
 * @param {*} item the item
 * @returns {boolean} true when it is a weighted value
 */
const isWeighted = function (item) {
  return item !== null && typeof item === 'object' &&
    Object.prototype.hasOwnProperty.call(item, 'rawweighting') &&
    Object.prototype.hasOwnProperty.call(item, 'value');
};

/**
 * A value in the form the on-premise engine gives it. A list of weighted
 * values becomes objects with value, weight and rawWeight, where weight is
 * the raw weighting as a proportion of 65535, and a WKT value becomes its
 * text.
 *
 * @param {*} value the value the service sent
 * @returns {*} the value as the Element Data gives it
 */
const fromService = function (value) {
  if (Array.isArray(value) && value.length > 0 && value.every(isWeighted)) {
    return value.map((item) => ({
      value: wktText(item.value),
      weight: item.rawweighting / RAW_WEIGHTING_MAX,
      rawWeight: item.rawweighting
    }));
  }
  return wktText(value);
};

/**
 * The IP intelligence cloud engine requires the 51Degrees
 * cloudRequestEngine to be placed in a pipeline before it.
 * It takes that raw JSON response and parses it to extract the
 * IP intelligence part. It also uses this data to generate a list
 * of properties. Properties that have weighted values are returned
 * as arrays of objects with 'value', 'weight' and 'rawWeight' entries,
 * and a WKT value as its text, as the on-premise engine returns them.
 **/
class IpIntelligenceCloud extends CloudEngine {
  /**
   * Constructor for IpIntelligenceCloud
   */
  constructor () {
    super(...arguments);

    this.dataKey = 'ip';
  }

  /**
   * Reads the IP Intelligence part of the cloud response as the
   * CloudEngine does, then gives each value in the form the on-premise
   * engine gives it.
   *
   * @param {FlowData} flowData the flow data to process
   * @returns {Promise<void>} resolves once the Element Data is set
   */
  processInternal (flowData) {
    const engine = this;
    return super.processInternal(flowData).then(function () {
      // The CloudEngine has set the Element Data, empty where the response
      // held no IP Intelligence part.
      const data = flowData.get(engine.dataKey);
      for (const value of Object.values(data.contents)) {
        if (value !== null && typeof value === 'object' && value.hasValue) {
          value.value = fromService(value.value);
        }
      }
    });
  }
}

module.exports = IpIntelligenceCloud;
