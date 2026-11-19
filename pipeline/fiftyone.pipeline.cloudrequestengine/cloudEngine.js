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
const engines = require('fiftyone.pipeline.engines');
const core = require('fiftyone.pipeline.core');
const errorMessages = require('./errorMessages');
const Engine = engines.Engine;
const AspectDataDictionary = engines.AspectDataDictionary;
const AspectPropertyValue = core.AspectPropertyValue;
const BasicListEvidenceKeyFilter = core.BasicListEvidenceKeyFilter;

/**
 * @typedef {import('fiftyone.pipeline.core').Pipeline} Pipeline
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('./cloudRequestEngine')} CloudRequestEngine
 */

/**
 * This is a template for all 51Degrees cloud engines.
 * It requires the 51Degrees cloudRequestEngine to be placed in a
 *  pipeline before it. It takes that raw JSON response and
 * parses it to extract the part under its data key.
 * It also uses this data to generate a list of properties and an evidence key filter
 **/
class CloudEngine extends Engine {
  constructor () {
    super(...arguments);

    this.dataKey = 'CloudEngineBase'; // This should be overridden

    /**
     * Whether an answer without this engine's element has been logged.
     *
     * @type {boolean}
     */
    this._missingElementReported = false;

    this.registrationCallbacks.push((pipeline, flowElement) => {
      this.handlePipelineRegistration(pipeline, flowElement);
    });
  }

  /**
   * Handles the registration of the Cloud Engine in a pipeline.
   * This method is called when a pipeline is registered,
   * and it ensures that the CloudRequestEngine is present in the pipeline.
   *
   * @param {Pipeline} pipeline - The pipeline being registered.
   * @param {FlowElement} flowElement - The flow element associated with the Cloud Engine.
   * @throws {Error} If no CloudRequestEngine comes before the Cloud Engine in the pipeline.
   */
  handlePipelineRegistration (pipeline, flowElement) {
    if (!pipeline.flowElements.cloud) {
      throw new Error('No CloudRequestEngine in Pipeline');
    }
    /**
     * @type {CloudRequestEngine}
     */
    this._cloudRequestEngine = pipeline.flowElements.cloud;
    this._flowElement = flowElement;
  }

  /**
   * Updates the Cloud Engine when the CloudRequestEngine is ready.
   * This method fetches properties and evidence keys from the CloudRequestEngine,
   * updating the Cloud Engine accordingly.
   *
   * @param {Function} resolve - Callback to be called on successful completion.
   * @param {Function} reject - Callback to be called if there is an error.
   */
  updateEngineWhenCloudRequestEngineReady (resolve, reject) {
    this._cloudRequestEngine.ready()
      .then(() => {
        this._flowElement.properties = this._cloudRequestEngine.flowElementProperties[this._flowElement.dataKey];
        this.updateProperties();
        this._flowElement.evidenceKeyFilter = new BasicListEvidenceKeyFilter(this._cloudRequestEngine.evidenceKeys);
        resolve(this);
      })
      .catch((error) => {
        this.errors = error;
        reject(this.errors);
      });
  }

  /**
   * Checks if the Cloud Engine is ready.
   * This method returns a Promise that resolves if the CloudRequestEngine is ready,
   * indicating that properties and evidence keys have been successfully fetched.
   *
   * @returns {Promise} A Promise that resolves if the CloudRequestEngine is ready and rejects if there is an error.
   */
  ready () {
    return new Promise((resolve, reject) => this.updateEngineWhenCloudRequestEngineReady(resolve, reject));
  }

  /**
   * Internal process method for all cloud engines
   *
   * @param {FlowData} flowData FlowData to process
   * @returns {Promise<void> | void} Completion promise
   */
  processInternal (flowData) {
    const engine = this;

    return engine.ready().then(function () {
      const cloudData = JSON.parse(flowData.get('cloud').get('cloud'));
      const elementData = cloudData ? cloudData[engine.dataKey] : undefined;
      const result = {};

      if (elementData === undefined) {
        // The cloud service leaves out a product the keys in use do not
        // include, and under a license key alone one that requestedProperties
        // names none of. That is not a fault in the request and cannot change
        // while the keys and the list stay the same, so it is a warning,
        // logged once rather than on every request, and the request carries
        // on with empty element data.
        if (engine._missingElementReported === false) {
          engine._missingElementReported = true;
          flowData.pipeline.log('warn', util.format(
            errorMessages.elementMissing, engine.dataKey, engine.dataKey,
            productHint(flowData, engine.dataKey)));
        }
      } else if (elementData === null) {
        // A null element is an answer to this request, so its reason is
        // logged every time.
        const reason = cloudData[engine.dataKey + 'nullreason'];
        flowData.pipeline.log('error', engine.dataKey + ' not populated. ' +
          (reason || util.format(errorMessages.elementNullNoReason,
            productHint(flowData, engine.dataKey))));
      } else {
        // A property with no value has a '<name>nullreason' beside it.
        Object.entries(elementData).forEach(function ([key, value]) {
          result[key] = new AspectPropertyValue();

          if (elementData[key + 'nullreason']) {
            result[key].noValueMessage = elementData[key + 'nullreason'];
          } else {
            result[key].value = value;
          }
        });
      }

      const data = new AspectDataDictionary(
        {
          flowElement: engine,
          contents: result
        });

      flowData.setElementData(data);
    });
  }
}

/**
 * How to check whether the key in use includes a product. The hint names a
 * resource key only where one is in use.
 *
 * @param {FlowData} flowData the flow data being processed
 * @param {string} dataKey the product's data key
 * @returns {string} the hint
 */
function productHint (flowData, dataKey) {
  const cloud = flowData.pipeline.flowElements.cloud;
  const licenseKeyAlone = cloud !== undefined && cloud.resourceKey === '';
  return util.format(licenseKeyAlone
    ? errorMessages.productHintLicenseKey
    : errorMessages.productHintResourceKey, dataKey);
}

module.exports = CloudEngine;
