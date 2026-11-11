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

const AspectData = require('fiftyone.pipeline.engines').AspectData;
const AspectPropertyValue = require('fiftyone.pipeline.core').AspectPropertyValue;

const swigHelpers = require('./swigHelpers');

const DataFileMissingPropertyService = require('./dataFileMissingPropertyService');

// The number of decimal places to use when converting WKB values to
// WKT strings.
const defaultWktDecimalPlaces = 16;

/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */

/**
 * Extension of aspectData which stores the results created by the SWIG wrapper
 */
class SwigData extends AspectData {
  /**
   * Constructor for SwigData
   *
   * @param {object} options options object
   * @param {FlowElement} options.flowElement the FlowElement the
   * data is part of
   * @param {object} options.swigResults the results from the
   * swig engine
   */
  constructor ({
    flowElement, swigResults
  }) {
    super(...arguments);
    this.swigResults = swigResults;
    this.missingPropertyService = new DataFileMissingPropertyService();
  }

  /**
   * Retrieves elementData via the swigWrapper but also casts it to the
   * correct type via a check of the engine's property list metadata.
   * IP intelligence properties are usually lists of weighted values
   * where the weight indicates the proportion of the result that
   * the value applies to. These are returned as JavaScript arrays of
   * objects with 'value', 'weight' and 'rawWeight' entries.
   *
   * @param {string} key the property key to retrieve
   * @returns {AspectPropertyValue} value property value
   */
  getInternal (key) {
    const property = this.flowElement.properties[key];

    if (property) {
      let value;
      let isWeighted = false;

      let type = property.type;

      // The MCC property is a list of weighted strings even though
      // the metadata type is a string.
      if (type === 'string' && property.name.toUpperCase() === 'MCC') {
        type = 'weightedstring';
      }

      switch (type) {
        case 'bool':
          value = this.swigResults.getValueAsBool(property.name);
          break;
        case 'string':
          value = this.swigResults.getValueAsString(property.name);
          break;
        case 'javascript':
          value = this.swigResults.getValueAsString(property.name);
          break;
        case 'int':
          value = this.swigResults.getValueAsInteger(property.name);
          break;
        case 'single':
        case 'double':
          value = this.swigResults.getValueAsDouble(property.name);
          break;
        case 'ipaddress':
          value = this.swigResults.getValueAsString(property.name);
          break;
        case 'wkb':
        case 'wkbr':
          value = this.swigResults.getValueAsString(property.name);
          break;
        case 'string[]':
          value = this.swigResults.getValues(property.name);
          break;
        case 'weightedbool':
          value = this.swigResults.getValuesAsWeightedBoolList(property.name);
          isWeighted = true;
          break;
        case 'weightedint':
          value = this.swigResults.getValuesAsWeightedIntegerList(property.name);
          isWeighted = true;
          break;
        case 'weightedsingle':
        case 'weighteddouble':
          value = this.swigResults.getValuesAsWeightedDoubleList(property.name);
          isWeighted = true;
          break;
        case 'weightedstring':
        case 'weightedipaddress':
          value = this.swigResults.getValuesAsWeightedStringList(property.name);
          isWeighted = true;
          break;
        case 'weightedwkb':
        case 'weightedwkbr':
          value = this.swigResults.getValuesAsWeightedWKTStringList(
            property.name, defaultWktDecimalPlaces);
          isWeighted = true;
          break;
        default:
          value = this.swigResults.getValueAsString(property.name);
          break;
      }

      const result = new AspectPropertyValue();

      if (value.hasValue()) {
        result.value = value.getValue();

        if (isWeighted) {
          result.value = swigHelpers.weightedVectorToArray(result.value);
        } else if (type === 'string[]') {
          result.value = swigHelpers.vectorToArray(result.value);
        }
      } else {
        result.noValueMessage = value.getNoValueMessage();
      }

      return result;
    }
  }

  /**
   * Looks for a key again in lower case, which is how the engine keys its
   * properties, so a key in any letter case finds its property.
   *
   * @param {string} key the property key to retrieve
   * @returns {AspectPropertyValue} value property value
   */
  getInternalIgnoringCase (key) {
    if (typeof key !== 'string') {
      return undefined;
    }
    const lowerKey = key.toLowerCase();
    return lowerKey === key ? undefined : this.getInternal(lowerKey);
  }
}

module.exports = SwigData;
