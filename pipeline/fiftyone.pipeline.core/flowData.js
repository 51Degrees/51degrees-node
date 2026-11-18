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
const Evidence = require('./evidence');
const LicenseKeys = require('./licenseKeys');

/**
 * @typedef {import('./pipeline')} Pipeline
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('./elementData')} ElementData
 */

/**
 * The newest node for each data key, in Pipeline order, being the order the
 * FlowElements were added to the Pipeline with the members of a parallel
 * group in the group's place. A key no FlowElement of the Pipeline has comes
 * last, in the order its data was added.
 *
 * @param {FlowData} flowData the FlowData
 * @returns {Array<{key: string, data: ElementData}>} the nodes
 */
function orderedNodes (flowData) {
  const nodes = [];
  const seen = new Set();
  for (let node = flowData.elementDataHead; node !== null;
    node = node.next) {
    if (!seen.has(node.key)) {
      seen.add(node.key);
      nodes.push(node);
    }
  }
  // The list holds the newest first, so it is reversed into the order the
  // data was added before it is sorted.
  nodes.reverse();
  const order = flowData.pipeline.dataKeyOrder;
  const position = (node) => order !== undefined && order.has(node.key)
    ? order.get(node.key)
    : Number.MAX_SAFE_INTEGER;
  return nodes
    .map((node, added) => ({ node, added }))
    .sort((a, b) => (position(a.node) - position(b.node)) ||
      (a.added - b.added))
    .map(({ node }) => node);
}

/**
 * FlowData is created by a specific pipeline
 * It collects evidence set by the user
 * It passes evidence to flowElements in the pipeline
 * These elements can return ElementData or populate an errors object
 */
class FlowData {
  /**
   * constructor for flowData created by a pipeline.
   * Called by a pipeline's createFlowData() method
   *
   * @param {Pipeline} pipeline the pipeline to add the FlowData to
   */
  constructor (pipeline) {
    this.pipeline = pipeline;

    // All evidence added to a flowData is stored in a special
    // collection class for easy retrieval and searching
    this.evidence = new Evidence(this);

    // Errors object, keyed by flowElement that caused the error
    this.errors = {};

    // Stop flag, if the flowData is stopped, no further
    // flowElements are processed
    this.stopped = false;

    // Set when processing starts, so a flow data is processed once.
    this.processing = false;

    // Set when processing has finished. From then on the flow data is read
    // only, apart from lazy properties, and a write to it throws. A test of
    // this field, never a lock.
    this.processed = false;

    // The Element Data, as a list whose head is the newest node. A node
    // holds the data key, the Element Data and the next node, and never
    // changes once added, so a reader follows the links with no lock. One
    // thread runs JavaScript, so a plain write adds a node even while the
    // members of a parallel group run.
    this.elementDataHead = null;

    return new Proxy(this, {
      get: (data, key) => {
        // This proxy can end up getting called by anything that tries
        // to access methods & properties on the object.
        // In future, this mechanism will be superseded by a less problematic
        // approach. For now, we work around this by only passing string keys
        // to the data getters.
        if (typeof key === 'string' || key === Symbol.iterator) {
          // A promise reads 'then' from every value it resolves with, and
          // the Pipeline resolves one with the Flow Data at each element.
          // 'then' is never Element Data, so it is answered here rather
          // than by a lookup that finds nothing.
          if (key === 'then') {
            return undefined;
          }
          let value = data[key];
          if (typeof value === 'undefined') {
            value = data.get(key);
          }
          return value;
        }
      }
    });
  }

  /**
   * Get back an object that lists all evidence that will be
   * used by any flowElements in the flowData's parent pipeline
   *
   * @returns {object} Evidence that is requested by flowElements
   */
  getEvidenceDataKey () {
    return this.pipeline.evidenceKeyFilter.filterEvidence(
      this.evidence.getAll());
  }

  /**
   * Stop a flowData from processing any further flowElements
   */
  stop () {
    this.pipeline.log('info', 'FlowData stopped');

    this.stopped = true;
  }

  /**
   * Set an error on the flowData (usually triggered by
   * something going wrong in a flowElement's process function)
   *
   * @param {*} error the error to throw
   * @param {FlowElement} flowElement the FlowElement the error is thrown on
   * @throws {Error} once the flow data has finished processing
   */
  setError (error, flowElement) {
    this.checkNotFinished('an error');

    let errorKey;

    if (flowElement && flowElement.dataKey) {
      errorKey = flowElement.dataKey;
    } else {
      // catch error when flowElement datakey isn't available
      errorKey = 'other';
    }

    error = LicenseKeys.mask(error);

    this.errors[errorKey] = error;

    let logMessage = 'Error occurred during processing';

    if (errorKey !== undefined) {
      logMessage = logMessage + ' of ' + errorKey + ". '" + error + "'";
    }

    this.pipeline.log('error', logMessage);
  }

  /**
   * Processes the flowData (running the process methods on all connected)
   *
   * @returns {Promise} result of processing. Once processing has finished,
   * the promise rejects with an AggregateError holding every error recorded
   * in flowData.errors, unless the pipeline suppresses process exceptions.
   */
  process () {
    if (this.processing) {
      return Promise.reject(new Error(errorMessages.flowDataProcessed));
    }
    this.processing = true;

    this.pipeline.log('info', 'Pipeline processing started');

    return this.pipeline.processMethod(this);
  }

  /**
   * Throws once processing has finished, because a finished flow data is
   * read only. Every method that writes to the flow data calls this first.
   *
   * @param {string} what what is being added, for the message
   * @throws {Error} once processing has finished
   */
  checkNotFinished (what) {
    if (this.processed) {
      throw new Error(util.format(errorMessages.flowDataFinished, what));
    }
  }

  /**
   * Add to the flowData object with a class derived from ElementData
   *
   * @param {ElementData} data instance of ElementData to
   * set for the FlowElement's datakey
   * @returns {FlowData} the FlowData object
   * @throws {Error} once the flow data has finished processing
   */
  setElementData (data) {
    this.checkNotFinished('element data');

    this.elementDataHead = {
      key: data.flowElement.dataKey,
      data,
      next: this.elementDataHead
    };

    return this;
  }

  /**
   * The ElementData under a FlowElement's data key, or undefined if there
   * is none. Data added later under the same key replaces the earlier, and
   * a key that finds nothing as given is looked for again ignoring its
   * letter case.
   *
   * @param {string} flowElementDataKey the datakey of a FlowElement
   * @returns {ElementData|undefined} data from the FlowElement
   */
  tryGet (flowElementDataKey) {
    for (let node = this.elementDataHead; node !== null; node = node.next) {
      if (node.key === flowElementDataKey) {
        return node.data;
      }
    }
    if (typeof flowElementDataKey === 'string') {
      const lower = flowElementDataKey.toLowerCase();
      for (let node = this.elementDataHead; node !== null; node = node.next) {
        if (typeof node.key === 'string' && node.key.toLowerCase() === lower) {
          return node.data;
        }
      }
    }
    return undefined;
  }

  /**
   * Every ElementData in the FlowData, in Pipeline order, being the order
   * the FlowElements were added to the Pipeline, with the members of a
   * parallel group in the group's place. Data under a key no FlowElement
   * of the Pipeline has comes last, in the order it was added.
   *
   * @returns {ElementData[]} the ElementData
   */
  listElementData () {
    return orderedNodes(this).map((node) => node.data);
  }

  /**
   * The ElementData by data key, in Pipeline order. Deprecated, as the
   * FlowData keeps its ElementData in a list, and this object is made
   * from the list each time it is read. Use get, tryGet or
   * listElementData instead.
   *
   * @deprecated
   * @returns {object} the ElementData by data key
   */
  get data () {
    const byKey = {};
    for (const node of orderedNodes(this)) {
      byKey[node.key] = node.data;
    }
    return byKey;
  }

  /**
   * Get ElementData by a flowElement's data key
   *
   * @param {string} flowElementDataKey the datakey of a FlowElement
   * @returns {ElementData} data from the FlowElement
   * @throws {string} a message naming the data key and the data keys there
   * are, when no element has given data under the key in any case
   */
  get (flowElementDataKey) {
    this.pipeline.log('debug', 'Getting flowElement ' + flowElementDataKey);

    const elementData = this.tryGet(flowElementDataKey);
    if (typeof elementData === 'undefined') {
      const message = util.format(errorMessages.noElementData,
        flowElementDataKey, orderedNodes(this)
          .map((node) => node.key).join(', '));
      throw message;
    }
    return elementData;
  }

  /**
   * get ElementData by a FlowElement object
   *
   * @param {FlowElement} flowElement The FlowElement to fetch data for
   * @returns {ElementData} data from the FlowElement
   */
  getFromElement (flowElement) {
    const key = flowElement.dataKey;

    return this.get(key);
  }

  /**
   * get an object ({key:value} store) of elementData
   * based on a metadata key and value, alternatively
   * pass in a filtering function to manually filter available propeties
   *
   * @param {string} metaKey a metakey such as "category"
   * @param {string|Function} metaValueorFuncton value or a filter
   * function which receives the value of the metaKey and returns a boolean
   * @returns {object} key value pair of matching properties and values
   */
  getWhere (metaKey, metaValueorFuncton) {
    const flowData = this;

    const propertyList = this.pipeline.propertyDatabase;

    let filteredProperties = {};

    if (propertyList[metaKey]) {
      if (typeof metaValueorFuncton !== 'function') {
        metaValueorFuncton = metaValueorFuncton.toLowerCase();

        if (propertyList[metaKey][metaValueorFuncton]) {
          filteredProperties = propertyList[metaKey][metaValueorFuncton];
        }
      } else {
        Object.keys(propertyList[metaKey]).forEach(function (value) {
          if (metaValueorFuncton(value)) {
            Object.assign(filteredProperties, propertyList[metaKey][value]);
          }
        });
      }
    }

    const output = {};

    Object.keys(filteredProperties).forEach(function (propertyName) {
      const property = filteredProperties[propertyName];
      const flowElementKey = property.flowElementKey;

      try {
        output[propertyName] = flowData.get(flowElementKey).get(propertyName);
      } catch (e) {
        // Ignore errors when fetching a property
        // as getWhere would often crash to an exception
        // if properties are not available, they should be excluded
      }
    });

    return output;
  }
}

module.exports = FlowData;
