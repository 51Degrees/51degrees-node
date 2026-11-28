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
const { AspectPropertyValue } = require('fiftyone.pipeline.core');
const { AspectDataDictionary } = require('fiftyone.pipeline.engines');
const CloudEngine = require('./cloudEngine');
const errorMessages = require('./errorMessages');
const humanConfidence = require('./humanConfidence');

/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */

// The data key of the Cloud Request Engine.
const requestEngineKey = 'cloud';

// The Properties this engine gives in a Pipeline with no Cloud Request
// Engine, keyed and described as the Cloud Request Engine gives them.
const propertiesWithoutRequestEngine = {
  [humanConfidence.valueProperty]: {
    name: 'HumanConfidence', type: 'String'
  },
  [humanConfidence.sourceProperty]: {
    name: 'HumanConfidenceSource', type: 'String'
  }
};

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
 *
 * Unlike the other cloud engines, it can be added to a Pipeline with no
 * Cloud Request Engine. Nothing is redeemed there, so it gives only the two
 * Properties: Medium and Active on a request that carries a sealed result,
 * and no value, with the reason, on any other request.
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

  /**
   * Takes the Cloud Request Engine, as any cloud engine does. Where the
   * Pipeline has none, the engine is not refused, and lists only
   * HumanConfidence and HumanConfidenceSource, as the specification gives
   * those two on a request that carries a sealed result.
   *
   * @see https://github.com/51Degrees/specifications/blob/main/pipeline-specification/features/human-confidence.md#where-the-sealed-result-is-not-redeemed
   * @param {Pipeline} pipeline the Pipeline being built
   * @param {FlowElement} flowElement the element registered
   * @throws {Error} where a Cloud Request Engine comes after this engine
   */
  handlePipelineRegistration (pipeline, flowElement) {
    if (hasRequestEngine(pipeline)) {
      super.handlePipelineRegistration(pipeline, flowElement);
      return;
    }
    this._flowElement = flowElement;
    if (this._cloudRequestEngine === undefined) {
      this.properties = JSON.parse(
        JSON.stringify(propertiesWithoutRequestEngine));
    }
  }

  /**
   * Ready at once where there is no Cloud Request Engine to wait for.
   *
   * @returns {Promise} resolves once the engine is ready
   */
  ready () {
    return this._cloudRequestEngine === undefined
      ? Promise.resolve(this)
      : super.ready();
  }

  /**
   * Processes as any cloud engine does, or, in a Pipeline with no Cloud
   * Request Engine, gives the two Properties without a request. That data
   * is never cached, as a request that carries a sealed result gives Values
   * for that request alone.
   *
   * @param {FlowData} flowData FlowData to process
   * @returns {Promise<true|void>} Completion promise, as for any engine
   */
  process (flowData) {
    if (hasRequestEngine(flowData.pipeline)) {
      return super.process(flowData);
    }
    const sealed = humanConfidence.sealedResult(flowData.evidence) !==
      undefined;
    const contents = {};
    for (const [key, property] of
      Object.entries(propertiesWithoutRequestEngine)) {
      contents[key] = sealed
        ? new AspectPropertyValue(null, key === humanConfidence.valueProperty
          ? humanConfidence.notRedeemedValue
          : humanConfidence.activeSource)
        : new AspectPropertyValue(util.format(
          errorMessages.missingPropertyNoCloudRequestEngine,
          property.name, this.dataKey));
    }
    flowData.setElementData(new AspectDataDictionary({
      flowElement: this, contents
    }));
    return Promise.resolve();
  }
}

/**
 * Whether a Pipeline holds a Cloud Request Engine anywhere in its chain.
 *
 * @param {Pipeline} pipeline the Pipeline
 * @returns {boolean} true when it does
 */
function hasRequestEngine (pipeline) {
  return flatten(pipeline.flowElementsChain).some((element) =>
    element.dataKey === requestEngineKey);
}

module.exports = DerivedCloudEngine;
