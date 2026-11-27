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

// The lazy properties of the data, by name in lower case, or undefined.
// Data made without the constructor, such as a hardware profile, has no
// state and so no lazy property.
const lazyProperties = (data) => {
  const state = data._state;
  return state === undefined ? undefined : state.lazy;
};

// The lazy property under a key, in any letter case, or undefined.
const lazyEntry = (data, key) => {
  const lazies = lazyProperties(data);
  return lazies === undefined || typeof key !== 'string'
    ? undefined
    : lazies.get(key.toLowerCase());
};

// The value of a lazy property whose task has finished, or the task's
// error. A JavaScript read cannot wait, so a read before the task has
// finished is an error that names getAsync.
const readLazy = (data, key, lazy) => {
  if (lazy.state === 'fulfilled') {
    return lazy.value;
  }
  if (lazy.state === 'rejected') {
    throw lazy.error;
  }
  throw new Error(util.format(errorMessages.lazyPending, key,
    data.flowElement.dataKey, key));
};

/**
 * Throws if the flow elements that write the data have finished.
 *
 * @param {object} data the element data, not its proxy
 * @param {string|symbol} key the name being written
 * @throws {Error} once they have finished
 */
function refuseFinished (data, key) {
  if (data._state.finished) {
    throw new Error(util.format(errorMessages.elementDataFinished,
      String(key), data.flowElement.dataKey));
  }
}

// The read only view of each contents object, made the first time the
// contents are reached through the data once it has finished.
const finishedViews = new WeakMap();

/**
 * A view of the object a dictionary keeps its values in, through which
 * setting or deleting a value throws, as a write to the data itself does
 * once it has finished. It is made only when the contents are reached
 * after that, so reading a value never goes through it.
 *
 * @param {object} data the element data, not its proxy
 * @param {object} contents the values
 * @returns {object} the view
 */
function finishedView (data, contents) {
  let view = finishedViews.get(contents);
  if (view === undefined) {
    view = new Proxy(contents, {
      set: (values, key, value) => {
        refuseFinished(data, key);
        values[key] = value;
        return true;
      },
      deleteProperty: (values, key) => {
        refuseFinished(data, key);
        delete values[key];
        return true;
      }
    });
    finishedViews.set(contents, view);
  }
  return view;
}

/**
 * Stores information created by a flowElement based on flowData.
 * Stored in flowData. Element data is written only by the flow element that
 * provides it, or the flow elements that share it, and only while they
 * process. Once they have finished, a write through the element data, or
 * into the contents object a dictionary keeps its values in, throws.
 *
 * Element data may come from a pool, and go back to it when the flow data
 * that holds it is disposed. Keeping a reference to element data after its
 * flow data is disposed is not supported, because the pool may give the
 * instance to another request. Nothing checks for that on a read.
 */
class ElementData {
  /**
   * Constructor for elementData
   *
   * @param {object} options the options object
   * @param {FlowElement} options.flowElement the FlowElement this data
   * is part of
   * @throws {Error} 'flowElement dataKey not found', when the FlowElement
   * has no data key
   */
  constructor ({ flowElement }) {
    if (!flowElement.dataKey) {
      throw new Error('flowElement dataKey not found');
    }

    this.flowElement = flowElement;

    // Whether the flow elements that write the data have finished
    // processing, when a write through the data throws, and its lazy
    // properties, if any. An object, as the proxy takes a field that reads
    // as false for a property name, and the Flow Data's list holds it, so
    // the Pipeline reads and marks it without going through the proxy.
    // Names starting with an underscore hold the data's own state and are
    // not writes.
    this._state = { finished: false, lazy: undefined };

    // The pool the data came from, if any, and whether it is shared with
    // other requests, as data a cache holds is, so it never goes back.
    this._pooling = { pool: null, shared: false };

    // Returns a proxy so that we can use flowData.flowElementDataKey
    // As a shortcut to flowData.get("flowElementDataKey")
    return new Proxy(this, {
      get: (data, key) => {
        // A dictionary reads its own values with no view in between.
        if (key === '_contents') {
          return data._contents;
        }
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
      // while they process, so a write once they have finished throws. A
      // write into a dictionary's contents is checked by the view the
      // contents give once the data has finished.
      set: (data, key, value) => {
        if (!(typeof key === 'string' && key.startsWith('_'))) {
          refuseFinished(data, key);
        }
        data[key] = value;
        return true;
      }
    });
  }

  /**
   * The object a dictionary keeps its values in. Once the flow elements
   * that write the data have finished, it is a view through which a write
   * throws.
   *
   * @returns {object|undefined} the values
   */
  get contents () {
    const contents = this._contents;
    if (!this._state.finished || contents === null ||
      typeof contents !== 'object') {
      return contents;
    }
    return finishedView(this, contents);
  }

  /**
   * Sets the object a dictionary keeps its values in.
   *
   * @param {object} contents the values
   */
  set contents (contents) {
    this._contents = contents;
  }

  /**
   * Returns the data to the state of a new instance, with no values and
   * open for writing, before a pool gives it to another request. Classes
   * inheriting from elementData that hold values override this and call
   * it.
   */
  reset () {
    this._state.finished = false;
    // A lazy property of the last request is dropped. A task of it that
    // has not finished keeps its own record, so it writes nothing here.
    this._state.lazy = undefined;
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
   * @throws {Error} a message naming the property and the element, when
   * the data has no value for the key in any case
   */
  get (key) {
    const lazy = lazyEntry(this, key);
    if (lazy !== undefined) {
      return readLazy(this, key, lazy);
    }
    let value = this.getInternal(key);
    if (typeof value === 'undefined') {
      value = this.getInternalIgnoringCase(key);
      if (typeof value === 'undefined') {
        throw new Error(util.format(errorMessages.genericMissingProperties, key) +
          (typeof this.flowElement === 'undefined'
            ? ''
            : ' in data for element "' +
            this.flowElement.dataKey) + '".' +
          util.format(errorMessages.noReasonUnknown));
      }
    }
    return value;
  }

  /**
   * Adds a lazy property, whose value is the result of a task the Flow
   * Element starts while it processes, such as a call to another resource.
   * The task never reads the Flow Data. Readers wait for it with getAsync,
   * and the Pipeline waits for every task before processing finishes, so a
   * read once processing has finished has the value or the task's error.
   *
   * @param {string} key the property name
   * @param {Promise} task the work that gives the value
   * @throws {Error} once the flow elements that write the data have finished
   */
  addLazyProperty (key, task) {
    refuseFinished(this, key);
    let lazies = lazyProperties(this);
    if (lazies === undefined) {
      lazies = new Map();
      this._state.lazy = lazies;
    }
    const lazy = { state: 'pending', recorded: false };
    lazy.settled = Promise.resolve(task).then((value) => {
      lazy.state = 'fulfilled';
      lazy.value = value;
    }, (error) => {
      lazy.state = 'rejected';
      lazy.error = error;
    });
    lazies.set(key.toLowerCase(), lazy);
  }

  /**
   * Whether the property is lazy, in any letter case.
   *
   * @param {string} key the property name
   * @returns {boolean} true if addLazyProperty added it
   */
  isLazyProperty (key) {
    return lazyEntry(this, key) !== undefined;
  }

  /**
   * Waits for the property's lazy task, where it has one, then gets the
   * value as get does. Every reader of a lazy property waits for the same
   * task, which runs once.
   *
   * @param {string} key the property name
   * @returns {Promise<*>} the value, or the task's error
   */
  getAsync (key) {
    const lazy = lazyEntry(this, key);
    const wait = lazy === undefined ? Promise.resolve() : lazy.settled;
    return wait.then(() => this.get(key));
  }

  /**
   * Waits for the tasks of every lazy property.
   *
   * @returns {Promise<boolean>} true once every task has given its value,
   * false once every task has finished and one or more failed
   */
  lazySettled () {
    const map = lazyProperties(this);
    if (map === undefined) {
      return Promise.resolve(true);
    }
    const lazies = [...map.values()];
    return Promise.all(lazies.map((lazy) => lazy.settled))
      .then(() => lazies.every((lazy) => lazy.state === 'fulfilled'));
  }

  /**
   * Whether the data has a lazy property, whether or not its task has
   * finished.
   *
   * @returns {boolean} true once addLazyProperty has added a property
   */
  hasLazyProperties () {
    return lazyProperties(this) !== undefined;
  }

  /**
   * Whether a lazy property's task has not yet finished.
   *
   * @returns {boolean} true while a task is running
   */
  hasPendingLazyProperties () {
    const lazies = lazyProperties(this);
    return lazies !== undefined &&
      [...lazies.values()].some((lazy) => lazy.state === 'pending');
  }

  /**
   * Records the failure of each lazy property's task in the Flow Data's
   * errors, as an error of the Flow Element that provides this data, once
   * however many readers meet it. A reader that meets a failure while the
   * Flow Data is processed calls this, and the Pipeline calls it before
   * processing finishes.
   *
   * @param {FlowData} flowData the Flow Data being processed
   */
  recordLazyFailures (flowData) {
    const lazies = lazyProperties(this);
    if (lazies === undefined) {
      return;
    }
    for (const lazy of lazies.values()) {
      if (lazy.state === 'rejected' && lazy.recorded === false) {
        lazy.recorded = true;
        flowData.setError(lazy.error, this.flowElement);
      }
    }
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
