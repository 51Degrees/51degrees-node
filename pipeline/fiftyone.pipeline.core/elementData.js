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
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {import('./flowData')} FlowData
 */

/**
 * Stores information created by a flowElement based on flowData.
 * Stored in flowData. Element data is written only by the flow element that
 * provides it, or the flow elements that share it, and only while they
 * process. Once they have finished, a write through the element data
 * throws.
 */
class ElementData {
  /**
   * Constructor for elementData
   *
   * @param {object} options the options object
   * @param {FlowElement} options.flowElement the FlowElement this data
   * is part of
   * @throws {string} 'flowElement dataKey not found', when the FlowElement
   * has no data key
   */
  constructor ({ flowElement }) {
    if (!flowElement.dataKey) {
      throw 'flowElement dataKey not found';
    }

    this.flowElement = flowElement;

    // Whether the flow elements that write the data have finished
    // processing, when a write through the data throws. An object, as the
    // proxy takes a field that reads as false for a property name. Names
    // starting with an underscore hold the data's own state and are not
    // writes.
    Object.defineProperty(this, '_writes', {
      value: { finished: false }
    });

    // Returns a proxy so that we can use flowData.flowElementDataKey
    // As a shortcut to flowData.get("flowElementDataKey")
    return new Proxy(this, {
      get: (data, key) => {
        // This proxy can end up getting called by anything that tries
        // to access methods & properties on the object.
        // This can include things like the inspector if you do something like
        // console.log(flowData.location)
        // In future, this mechanism will be superseded by a less problematic
        // approach. For now, we work around this by only passing string keys
        // to the data getters.
        if (typeof (key) === 'string' || key === Symbol.iterator) {
          try {
            return data[key] || data.get(key);
          } catch (e) {
            // If the key was 'inspect' and an error was thrown then we
            // can ignore it. Otherwise, throw the error back up the stack.
            if (key !== 'inspect') {
              throw (e);
            }
          }
        }
      },
      // Element data is written only by the flow elements that write it,
      // while they process, so a write once they have finished throws.
      set: (data, key, value) => {
        if (data._writes.finished && !(typeof key === 'string' &&
          key.startsWith('_'))) {
          throw new Error(util.format(errorMessages.elementDataFinished,
            String(key), data.flowElement.dataKey));
        }
        data[key] = value;
        return true;
      }
    });
  }

  /**
   * Internal get method for elementData to retrieve an element from it
   * called via the elementData's get method
   * This method is overriden by classes inheriting from elementData
   *
   * @param {string} key the key to retrieve a property value for
   */
  getInternal (key) {

  }

  /**
   * Looks for a key again ignoring its letter case, after getInternal found
   * nothing for the key as given, because property names are compared
   * ignoring case. Classes inheriting from elementData override this, and
   * this one finds nothing.
   *
   * @param {string} key the key to retrieve a property value for
   * @returns {*} the value, or undefined if there is none
   */
  getInternalIgnoringCase (key) {
    return undefined;
  }

  /**
   * A wrapper that performs actions before passing on processing
   * (or skipping) the getInternal method. A key that finds nothing as given
   * is looked for again ignoring its letter case, so a read that found its
   * value before costs no more.
   *
   * @param {string} key the key to retrieve a property value for
   * @returns {FlowData} value
   * @throws {string} a message naming the property and the element, when
   * the data has no value for the key in any case
   */
  get (key) {
    let value = this.getInternal(key);
    if (typeof value === 'undefined') {
      value = this.getInternalIgnoringCase(key);
      if (typeof value === 'undefined') {
        throw util.format(errorMessages.genericMissingProperties, key) +
          (typeof this.flowElement === 'undefined'
            ? ''
            : ' in data for element "' +
            this.flowElement.dataKey) + '".' +
          util.format(errorMessages.noReasonUnknown);
      }
    }
    return value;
  }

  /**
   * Return string value of property
   *
   * @param {string} key the key to retreive a property value for
   * @returns {string} value
   */
  getAsString (key) {
    const result = this.get(key);

    if (typeof result !== 'undefined') {
      return result.toString();
    }
  }

  /**
   * Return float value of property
   *
   * @param {string} key the key to retreive a property value for
   * @returns {number} float value
   */
  getAsFloat (key) {
    const result = this.get(key);

    if (typeof result !== 'undefined') {
      return parseFloat(result);
    }
  }

  /**
   * Return int value of property
   *
   * @param {string} key the key to retreive a property value for
   * @returns {number} int value
   */
  getAsInteger (key) {
    const result = this.get(key);

    if (typeof result !== 'undefined') {
      return parseInt(result);
    }
  }
}

module.exports = ElementData;
