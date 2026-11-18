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

const LicenseKeys = require('./licenseKeys');
const FlowData = require('./flowData');
const ElementData = require('./elementData');
const EventEmitter = require('events');
const EvidenceKeyFilter = require('./evidenceKeyFilter');

/**
 * @typedef {import('./flowElement')} FlowElement
 * @typedef {any} DataFileUpdateService
 */

/**
 * The Evidence a Pipeline accepts, being every key one of its FlowElements
 * accepts. Each element's filter is read when a key is checked, as an
 * element's list can change once its data or the cloud service's answer
 * arrives.
 */
class PipelineEvidenceKeyFilter extends EvidenceKeyFilter {
  /**
   * Constructor for PipelineEvidenceKeyFilter
   *
   * @param {Pipeline} pipeline the Pipeline whose elements are asked
   */
  constructor (pipeline) {
    super();
    this.pipeline = pipeline;
  }

  /**
   * Whether any of the Pipeline's elements accepts the key.
   *
   * @param {string} key the evidence key to check
   * @returns {boolean} whether any element accepts the key
   */
  filterEvidenceKey (key) {
    return Object.values(this.pipeline.flowElements).some(element =>
      element.evidenceKeyFilter &&
      element.evidenceKeyFilter.filterEvidenceKey(key));
  }
}

/**
 * Records whether the flow elements that write an element data have
 * finished, which the element data checks before a write. Anything that is
 * not element data is left alone.
 *
 * @param {ElementData|undefined} data the element data
 * @param {boolean} finished whether they have finished
 */
function setFinished (data, finished) {
  if (data instanceof ElementData) {
    data._writes.finished = finished;
  }
}

/**
 * Pipeline holding a list of flowElements for processing, can create
 * flowData that will be passed through these, collecting elementData
 * Should be constructed through the PipelineBuilder class
 */
class Pipeline {
  /**
   * Constructor for Pipeline
   *
   * @param {FlowElement[]} flowElements list of FlowElements to
   * add to the Pipeline
   * @param {boolean} suppressProcessExceptions If true then pipeline
   * will suppress exceptions added to FlowData.
   * @param {DataFileUpdateService} dataFileUpdateService Service that registers FlowElements
   */
  constructor (flowElements = [], suppressProcessExceptions = false, dataFileUpdateService = null) {
    const pipeline = this;

    // The chain of flowElements to run, including arrays of parallel
    // elements. A frozen copy, so a built Pipeline cannot change whatever
    // happens to the lists it was given.
    this.flowElementsChain = /** @type {FlowElement[]} */ (Object.freeze(
      flowElements.map((slot) =>
        Array.isArray(slot) ? Object.freeze([...slot]) : slot)));

    // If true then pipeline will suppress exceptions added to FlowData.
    this.suppressProcessExceptions = suppressProcessExceptions;

    /**
     * A logger for emitting messages
     * @type {EventEmitter}
     */
    this.eventEmitter = new EventEmitter();

    // Flattened dictionary of flowElements the pipeline contains, frozen
    // once the constructor has filled it
    /**
     * @type {object}
     */
    this.flowElements = {};

    if (dataFileUpdateService) {
      this.dataFileUpdateService = dataFileUpdateService;
      this.dataFileUpdateService.registerPipeline(this);
    }

    // Run through flowElements and store them by dataKey
    // in the pipeline.flowElements object.
    // Recursive function so it can handle parallel elements
    // which are passed in as arrays
    const storeInFlowElementList = function (flowElementList) {
      flowElementList.forEach(function (slot) {
        if (Array.isArray(slot)) {
          storeInFlowElementList(slot);
        } else {
          // Run registration function
          slot.onRegistration(pipeline, slot);

          pipeline.flowElements[slot.dataKey] = slot;

          // Register link between flowElement and a pipeline it's been added to
          slot.pipelines.push(pipeline);
        }
      });
    };

    storeInFlowElementList(this.flowElementsChain);
    Object.freeze(this.flowElements);

    // The position of each data key in Pipeline order, by which a FlowData
    // lists its ElementData.
    /**
     * @type {Map<string, number>}
     */
    this.dataKeyOrder = new Map(Object.keys(this.flowElements)
      .map((key, index) => [key, index]));

    // The Evidence the Pipeline accepts, from its elements' filters.
    /**
     * @type {EvidenceKeyFilter}
     */
    this.evidenceKeyFilter = new PipelineEvidenceKeyFilter(this);

    // Empty property database, later populated and possibly
    // updated by flowElements' property lists
    /**
     * @type {object}
     */
    this.propertyDatabase = {};

    // Update property list - Note that some of these could be async
    // so the property list might not be updated straight away.
    // When this happens, getWhere calls will return
    // empty for those specific properties
    Object.keys(pipeline.flowElements).forEach(function (key) {
      const flowElement = pipeline.flowElements[key];
      pipeline.updatePropertyDataBaseForElement(flowElement);
    });

    // Create the FlowData process function here to save
    // having to do it each time the FlowData is processed.
    // This packages up all the logic for generating promises,
    // sync / async and others
    const processMethod = function () {
      const promiseChain = [];

      // Runs one FlowElement. A failure is the FlowElement's error, added
      // to the FlowData by onError, which by default adds it at once.
      const makeProcessPromise = function (flowElement, onError) {
        return function (flowData) {
          if (flowData.stopped) {
            return Promise.resolve(flowData);
          }

          pipeline.eventEmitter.emit(
            'info',
            'processing ' + flowElement.dataKey
          );

          return new Promise(function (resolve) {
            const setError = function (error) {
              if (onError) {
                onError(error);
              } else {
                flowData.setError(error, flowElement);
              }

              return resolve(flowData);
            };

            const local = {};

            // Element data another flow element added under this key is
            // open for writing again while this one processes.
            setFinished(flowData.tryGet(flowElement.dataKey), false);

            let process;

            try {
              process = Promise.resolve(flowElement.process(flowData, local));
            } catch (e) {
              setFinished(flowData.tryGet(flowElement.dataKey), true);
              return setError(e);
            }

            process
              .finally(function () {
                setFinished(flowData.tryGet(flowElement.dataKey), true);
              })
              .then(function () {
                resolve(flowData);
              })
              .catch(setError);
          });
        };
      };

      pipeline.flowElementsChain.forEach(function (item) {
        if (Array.isArray(item)) {
          // A parallel group runs its members together and finishes once
          // every member has. An error a member throws is held until then,
          // and added in the order the members were added to the group.
          promiseChain.push(function (flowData) {
            const thrown = item.map(() => undefined);

            return Promise.all(item.map(function (flowElement, index) {
              return makeProcessPromise(flowElement, function (error) {
                thrown[index] = { error };
              })(flowData);
            })).then(function () {
              thrown.forEach(function (failure, index) {
                if (failure !== undefined) {
                  flowData.setError(failure.error, item[index]);
                }
              });
              return flowData;
            });
          });
        } else {
          promiseChain.push(makeProcessPromise(item));
        }
      });

      return function (flowData) {
        return promiseChain.reduce(function (cur, next) {
          return cur.then(next);
        }, Promise.resolve(flowData)).finally(function () {
          // Processing has finished, whether or not it rejected, so the flow
          // data and every element data in it, including any the caller
          // added, are read only.
          flowData.processed = true;
          flowData.listElementData().forEach((data) =>
            setFinished(data, true));
          // A flow data disposed while it processed gives its element data
          // back to the pools now that nothing writes it.
          if (flowData.disposed) {
            flowData.dispose();
          }
        }).then(function () {
          // Every error has been recorded.
          const errors = Object.values(flowData.errors);
          if (errors.length > 0 && !pipeline.suppressProcessExceptions) {
            throw new AggregateError(errors,
              'Errors occurred during processing of ' +
              Object.keys(flowData.errors).join(', '));
          }
          return flowData;
        });
      };
    };

    this.processMethod = processMethod();
  }

  /**
   * get a FlowElement by its dataKey
   *
   * @param {string} key the datakey of the FlowElement
   * @returns {FlowElement} the FlowElement for the datakey
   */
  getElement (key) {
    return this.flowElements[key];
  }

  /**
   * Method to attach listeners to the logger
   * Shorthand access to the enclosed event emitter
   *
   * @param {string} listener type of message to listen to
   * @param {Function} callback a callback to react to the log
   */
  on (listener, callback) {
    this.eventEmitter.on(listener, callback);
  }

  /**
   * Shorthand to trigger a message on the pipeline's eventEmitter.
   *
   * Every detection goes through here several times, so an emitted message
   * is passed on as it is. A license key is masked where it can reach a
   * message, which is the cloud request engine, the data update service
   * and the 51Did client.
   *
   * @param {string} type type of message
   * @param {*} message message to store in the log
   */
  log (type, message) {
    // Node throws an 'error' event that nothing listens for, so such an
    // error is written to the console instead, masked, because the console
    // is the end of the line. A failed detection's message arrives already
    // masked by FlowData.setError. The cloud engine also logs an error here
    // for a null element while the detection carries on.
    if (type === 'error' && this.eventEmitter.listenerCount('error') === 0) {
      console.error(LicenseKeys.mask(message));
      return;
    }
    this.eventEmitter.emit(type, message);
  }

  /**
   * Create a FlowData element from the pipeline
   *
   * @returns {FlowData} a FlowData object for the Pipeline
   * containing methods for adding evidence and processing via
   * the FlowElements in the Pipleine.
   */
  createFlowData () {
    return new FlowData(this);
  }

  /**
   *  Update pipeline's property database for FlowElement
   *
   * @param {FlowElement} flowElement FlowElement to update
   * @returns {void}
   */
  updatePropertyDataBaseForElement (flowElement) {
    const pipeline = this;

    return new Promise(function (resolve) {
      // First delete any instances of properties for this element

      Object.keys(pipeline.propertyDatabase).forEach(function (metaKey) {
        Object.keys(pipeline.propertyDatabase[metaKey]).forEach(function (
          metaValue
        ) {
          const list = pipeline.propertyDatabase[metaKey][metaValue];
          Object.keys(list).forEach(function (key) {
            const value = list[key];
            if (value.flowElementKey === flowElement.dataKey) {
              delete pipeline.propertyDatabase[metaKey][metaValue][key];
            }
          });
        });
      });

      Promise.resolve(flowElement.getProperties()).then(function (properties) {
        const flowElementDataKey = flowElement.dataKey;

        if (!properties) {
          return;
        }

        Object.keys(properties).forEach(function (
          propertyKey
        ) {
          const propertyMeta = properties[propertyKey];
          const propertyName = propertyKey;

          Object.keys(propertyMeta).forEach(function (metaKey) {
            const metaValue = propertyMeta[metaKey].toString().toLowerCase();
            metaKey = metaKey.toLowerCase();

            if (!pipeline.propertyDatabase[metaKey]) {
              pipeline.propertyDatabase[metaKey] = {};
            }

            if (!pipeline.propertyDatabase[metaKey][metaValue]) {
              pipeline.propertyDatabase[metaKey][metaValue] = {};
            }

            pipeline.propertyDatabase[metaKey][metaValue][propertyKey] = {
              propertyName,
              flowElementKey: flowElementDataKey
            };
          });
        });

        resolve();
      });
    });
  }
}

module.exports = Pipeline;
