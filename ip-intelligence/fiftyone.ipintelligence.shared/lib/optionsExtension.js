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

const CLOUD_REQUEST_ENGINE_NAME = 'cloudRequestEngine';

const ONPREMISE_IP_ENGINE = 'ipIntelligenceOnPremise';

class OptionsExtension {
  /**
   * Get the element with the given name from the pipeline options
   *
   * @param {object} options pipeline options
   * @param {string} elementName name of the element to get
   * @returns {object} the element or undefined if not found
   */
  static getElement (options, elementName) {
    if (options.PipelineOptions) {
      if (options.PipelineOptions.Elements) {
        for (const e of options.PipelineOptions.Elements) {
          if (e.elementName &&
            e.elementName.endsWith(elementName)) {
            return e;
          }
        }
      }
    }
  }

  /**
   * Get the data file path from the pipeline options
   *
   * @param {object} options pipeline options
   * @returns {string} the data file path or undefined if not set
   */
  static getDataFilePath (options) {
    const onPremiseElement = this.getElement(options, ONPREMISE_IP_ENGINE);
    if (onPremiseElement &&
      onPremiseElement.elementParameters &&
      onPremiseElement.elementParameters.dataFilePath) {
      return onPremiseElement.elementParameters.dataFilePath;
    }
  }

  /**
   * Set the data file path in the pipeline options
   *
   * @param {object} options pipeline options
   * @param {string} newDataFilePath the new data file path
   * @returns {void}
   */
  static setDataFilePath (options, newDataFilePath) {
    const onPremiseElement = this.getElement(options, ONPREMISE_IP_ENGINE);
    if (onPremiseElement) {
      if (!onPremiseElement.elementParameters) {
        onPremiseElement.elementParameters = { dataFilePath: newDataFilePath };
      } else {
        onPremiseElement.elementParameters.dataFilePath = newDataFilePath;
      }
    }
  }

  /**
   * Update relative element paths by prepending the supplied directory
   *
   * @param {object} options pipeline options
   * @param {string} appendDir directory to prepend to relative paths
   * @returns {void}
   */
  static updateElementPath (options, appendDir) {
    if (options.PipelineOptions) {
      if (options.PipelineOptions.Elements) {
        for (const e of options.PipelineOptions.Elements) {
          if (e.elementName &&
            e.elementName.startsWith('.')) {
            e.elementName = appendDir + '/' + e.elementName;
          }
        }
      }
    }
  }

  /**
   * Get the resource key from the pipeline options
   *
   * @param {object} options pipeline options
   * @returns {string} the resource key or undefined if not set
   */
  static getResourceKey (options) {
    const cloudRequestElement = this.getElement(options, CLOUD_REQUEST_ENGINE_NAME);
    if (cloudRequestElement &&
      cloudRequestElement.elementParameters &&
      cloudRequestElement.elementParameters.resourceKey) {
      return cloudRequestElement.elementParameters.resourceKey;
    }
  }

  /**
   * Set the resource key in the pipeline options
   *
   * @param {object} options pipeline options
   * @param {string} resourceKey the new resource key
   * @returns {void}
   */
  static setResourceKey (options, resourceKey) {
    const cloudRequestElement = this.getElement(options, CLOUD_REQUEST_ENGINE_NAME);
    if (cloudRequestElement) {
      if (!cloudRequestElement.elementParameters) {
        cloudRequestElement.elementParameters = { resourceKey };
      } else {
        cloudRequestElement.elementParameters.resourceKey = resourceKey;
      }
    }
  }
}

module.exports = OptionsExtension;
