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
const CloudEngine = require('./cloudEngine');
const errorMessages = require('./errorMessages');

/**
 * Every element in a list of Pipeline slots, where a slot is an element or
 * a list of elements that run in parallel.
 *
 * @param {Array} slots the slots
 * @returns {Array} the elements
 */
function flatten (slots) {
  return slots.reduce((all, slot) =>
    all.concat(Array.isArray(slot) ? flatten(slot) : [slot]), []);
}

/**
 * The cloud engine for the derived product, which gives HumanConfidence and
 * HumanConfidenceSource. On a request that carries a sealed Human
 * Confidence result, the Cloud Request Engine redeems it, and this engine
 * gives the Value it redeemed to, or Medium where it was not redeemed, with
 * HumanConfidenceSource Active.
 */
class DerivedCloudEngine extends CloudEngine {
  constructor () {
    super(...arguments);

    this.dataKey = 'derived';

    // A Pipeline keeps one element and one Element Data for each data key,
    // so another element under 'derived', such as the DerivedPropertyElement,
    // would replace this one or be replaced by it. The Pipeline is refused
    // when it is built instead.
    this.registrationCallbacks.push((pipeline) => {
      const other = flatten(pipeline.flowElementsChain).find((element) =>
        element !== this &&
        String(element.dataKey).toLowerCase() === this.dataKey);
      if (other !== undefined) {
        throw new Error(util.format(errorMessages.derivedKeyTaken,
          other.constructor.name));
      }
    });
  }
}

module.exports = DerivedCloudEngine;
