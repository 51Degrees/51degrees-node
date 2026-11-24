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

const util = require('util');
const errorMessages = require('./errorMessages');
/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */

/**
 * The metadata of the Property of the name given, compared ignoring case.
 *
 * @param {object} properties an element's Property metadata by name
 * @param {string} key the Property name asked for
 * @returns {object | undefined} the Property's metadata, if it is listed
 */
const listed = function (properties, key) {
  if (!properties || typeof key !== 'string') {
    return undefined;
  }
  if (properties[key] !== undefined) {
    return properties[key];
  }
  const lower = key.toLowerCase();
  const name = Object.keys(properties)
    .find((property) => property.toLowerCase() === lower);
  return name === undefined ? undefined : properties[name];
};

/**
 * Base class for a missing property service that throws
 * an error if the property is not available for some reason
 **/
class MissingPropertyService {
  /**
   * Check is called if a property is requested that exists
   * in the FlowElement property list but is not available
   * in the AspectData returned by the FlowElement. It throws the message
   * for the reason, decided in the order the specification gives.
   *
   * @param {string} key property key
   * @param {FlowElement} flowElement flowelement the data
   * was requested in
   * @throws {string} the message saying why the Property is missing
   */
  check (key, flowElement) {
    const dataKey = flowElement === undefined
      ? 'Unknown'
      : flowElement.dataKey;
    const format = (message, ...rest) =>
      util.format(message, key, dataKey, ...rest);

    // The metadata lists the Property, so it is missing either because the
    // data file's tier lacks it or because the engine was told not to give
    // it.
    const property = flowElement === undefined
      ? undefined
      : listed(flowElement.properties, key);
    if (property !== undefined) {
      const tiers = this.tiersWithProperty(property, flowElement);
      if (tiers === undefined) {
        throw format(errorMessages.missingPropertyExcluded);
      }
      throw tiers.length === 0
        ? format(errorMessages.missingPropertyUpgradeNoTiers)
        : format(errorMessages.missingPropertyUpgrade, tiers.join(','),
          flowElement.constructor.name);
    }

    if (this._isCloudEngine(flowElement)) {
      // A cloud engine whose Resource Key has no product for it is left with
      // no Property metadata at all once the cloud service has answered.
      const cloud = flowElement._cloudRequestEngine;
      const loaded = flowElement.properties === undefined ||
        Object.keys(flowElement.properties).length > 0 ||
        (cloud !== undefined && cloud.flowElementProperties !== undefined &&
          Object.keys(cloud.flowElementProperties).length > 0);
      if (loaded) {
        const names = Object.keys(flowElement.properties || {});
        throw names.length === 0
          ? format(errorMessages.missingPropertyProduct, dataKey)
          : format(errorMessages.missingPropertyNotIncluded, dataKey,
            names.join(','));
      }
      if (flowElement.errors !== undefined) {
        throw format(errorMessages.missingPropertyCloudRequestFailed);
      }
    }

    throw format(errorMessages.missingPropertyUnknown);
  }

  /**
   * The data tiers that have a Property the metadata lists, where the
   * engine's data file is not one of them. A service for an on-premise
   * engine whose data files come in tiers gives them, and this one gives
   * none, so the Property is taken to be excluded.
   *
   * @param {object} property the Property's metadata
   * @param {FlowElement} flowElement the engine the Property was asked of
   * @returns {string[] | undefined} the tiers that have the Property, or
   * undefined where the engine's data file has it
   */
  tiersWithProperty (property, flowElement) {
    return undefined;
  }

  /**
   * Return true if the supplied flow element is a CloudEngine, false if not.
   *
   * @param {FlowElement} flowElement The flow element to check
   * @returns {boolean} Is CloudEngine
   */
  _isCloudEngine (flowElement) {
    try {
      if (Object.getPrototypeOf(flowElement) === null) {
        return false;
      } else {
        return Object.getPrototypeOf(flowElement).constructor.name === 'CloudEngine' ||
          this._isCloudEngine(Object.getPrototypeOf(flowElement));
      }
    } catch (e) {
      // If some error ocurred, then assume this is not a cloud engine.
      return false;
    }
  }
}

module.exports = MissingPropertyService;
