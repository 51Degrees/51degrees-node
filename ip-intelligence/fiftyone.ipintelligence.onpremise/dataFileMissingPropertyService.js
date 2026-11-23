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

const MissingPropertyService = require('fiftyone.pipeline.engines').MissingPropertyService;

/**
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */

/**
 * Instance of the MissingPropertyService class that checks if a
 * property is available in the current dataFile
 */
class IpIntelligenceMissingPropertyService extends MissingPropertyService {
  /**
   * The data tiers that have a Property the metadata lists, where the
   * engine's data file is not one of them, so the message says which
   * licence or data file to upgrade to.
   *
   * @param {object} property the Property's metadata
   * @param {FlowElement} flowElement the engine the Property was asked of
   * @returns {string[] | undefined} the tiers that have the Property, or
   * undefined where the engine's data file has it
   */
  tiersWithProperty (property, flowElement) {
    const tiers = property.dataFiles || [];
    return tiers.includes(flowElement.engine.getProduct()) ? undefined : tiers;
  }
}

module.exports = IpIntelligenceMissingPropertyService;
