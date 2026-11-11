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
const Engine = require('fiftyone.pipeline.engines').Engine;
const AspectDataDictionary = require('fiftyone.pipeline.engines')
  .AspectDataDictionary;
const BasicListEvidenceKeyFilter = require('fiftyone.pipeline.core')
  .BasicListEvidenceKeyFilter;
const LicenseKeys = require('fiftyone.pipeline.core').LicenseKeys;
const sharedValues = require('./sharedValues');
const errorMessages = require('./errorMessages');
const RequestClient = require('./requestClient');
const CloudRequestError = require('./cloudRequestError');

// Names the cloud service reads its credentials and property list from,
// which Evidence must not supply under any prefix or in any letter case.
const reservedFields = ['resource', 'license', 'licence', 'values'];

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').Evidence} Evidence
 */

// Whether an object has a member of its own by that name, so that a name
// such as constructor is not found on the prototype.
const hasOwn = (object, name) =>
  Object.prototype.hasOwnProperty.call(object, name);

// Whether each element data the engine has made may be cached.
const cacheableData = new WeakMap();

// The key a web integration gives the web request itself. It is a view of
// the whole request and not a value to send, so it is left out.
const webRequestKey = 'server.http-request';

/**
 * Whether the response in an element data has a top level member named
 * fodid, in any case. A response that cannot be read is cached as before.
 *
 * @param {object} data the element data of a response
 * @returns {boolean} true if the response has a top level fodid member
 */
function holdsFodId (data) {
  try {
    const text = data.get('cloud');
    if (typeof text !== 'string' || !/fodid/i.test(text)) {
      return false;
    }
    const response = JSON.parse(text);
    return response !== null &&
      typeof response === 'object' &&
      Object.keys(response).some((name) => name.toLowerCase() === 'fodid');
  } catch (e) {
    return false;
  }
}

// Engine that makes a call to the 51Degrees cloud service
// Returns raw JSON as a "cloud" property under "cloud" dataKey
class CloudRequestEngine extends Engine {
  /**
   * Constructor for CloudRequestEngine
   *
   * @param {object} options options object
   * @param {string} options.resourceKey resourcekey for cloud service
   * @param {string} options.licenseKey licensekey for cloud service, beside
   * a resourceKey or on its own. On its own, requestedProperties is
   * required.
   * @param {Array<string>|string} options.requestedProperties the fully
   * qualified names of the properties to ask for, such as device.ismobile,
   * as a list or one comma separated string. Beside a resourceKey the cloud
   * service adds them to the properties the resource key carries.
   * @param {string} options.baseURL url the cloud service is located at
   * if overriding default
   * @param {string} options.cloudRequestOrigin The value to set for the Origin
   * header when making requests to the cloud service.
   * This is used by the cloud service to check that the request is being
   * made from a origin matching those allowed by the resource key.
   * For more detail, see the 'Request Headers' section in the
   * <a href="https://cloud.51degrees.com/api-docs/index.html">cloud documentation</a>.
   * @param {RequestClient} options.requestClient Set predefined RequestClient.
   */
  constructor (
    {
      resourceKey,
      licenseKey,
      requestedProperties,
      baseURL,
      cloudRequestOrigin,
      requestClient
    }) {
    super(...arguments);

    this.dataKey = 'cloud';

    // A key that is empty or only whitespace counts as absent. Any other
    // key is sent as it is given.
    this.resourceKey = keyText(resourceKey);
    this.licenseKey = keyText(licenseKey);
    this.requestedProperties = propertyNames(requestedProperties);
    refuseInvalidCredentials(this);

    // Set once the requested properties have been compared with an answer.
    this.notCoveredReported = false;

    this.cloudRequestOrigin = cloudRequestOrigin;
    if (requestClient !== undefined) {
      this.requestClient = requestClient;
    } else {
      this.requestClient = new RequestClient();
    }

    // Check if baseURL is set. If not try to set it the environment variable
    // if presents, else set to default value.
    //
    // A host other than cloud.51degrees.com would be used to (a) use an
    // on premise web server, or (b) use a privately hosted version of the
    // 51Degrees cloud for performance reasons. This is the private hosting
    // option of the 51Degrees cloud service. Both run the same service, so
    // everything built on this engine works unchanged once FOD_CLOUD_API_URL
    // names the other host's API base including the /api/v4/ segment.
    if (!baseURL) {
      baseURL = process.env.FOD_CLOUD_API_URL;
      if (!baseURL) {
        baseURL = sharedValues.baseURLDefault;
      }
    }

    // Check if the set baseURL ends with '/'
    if (baseURL && baseURL.endsWith('/') === false) {
      baseURL = baseURL + '/';
    }
    this.baseURL = baseURL;
    this.evidenceKeys = [];

    // Properties of connected FlowElements
    this.flowElementProperties = {};
  }

  /**
   * Check if the keys and properties have been fetched.
   *
   * This computed property determines whether the keys of a 'flowElementProperties' object and the 'evidenceKeyFilter'
   * array both have elements, indicating that the necessary data has been fetched and is ready for use.
   *
   * @returns {boolean} True if the keys and properties are fetched and ready; otherwise, false.
   */
  get keysAndPropertiesFetched () {
    return Object.keys(this.flowElementProperties).length > 0 && this.evidenceKeyFilter.length > 0;
  }

  /**
   * Fetches evidence keys and properties data.
   *
   * This method asynchronously fetches evidence keys and properties required for the operation.
   * It uses Promises to handle data retrieval and provides callback functions for success and failure scenarios.
   *
   * @param {Function} resolveCallback - A callback function to be called when the data is successfully fetched.
   * It will receive the current instance as a parameter.
   *
   * @param {Function} rejectCallback - A callback function to be called when an error occurs during data retrieval.
   * It will receive the error information as a parameter.
   */
  fetchEvidenceKeysAndProperties (resolveCallback, rejectCallback) {
    const self = this;
    Promise.all([this.getEvidenceKeys(), this.fetchProperties()]).then(function () {
      resolveCallback(self);
    }).catch(function (errors) {
      self.errors = errors;
      if (self.pipelines) {
        // Log error on all pipelines engine is attached to
        self.pipelines.forEach(function (pipeline) {
          pipeline.log('error', {
            source: 'CloudRequestEngine',
            message: self.errors
          });
        });
        rejectCallback(self.errors);
      }
    });
  }

  /**
   * Function for testing if the cloud engine is ready
   * Checks to see if properties and evidence keys have been fetched
   *
   * @returns {Promise} whether ready
   */
  ready () {
    const self = this;
    return new Promise(function (resolve, reject) {
      if (self.keysAndPropertiesFetched) {
        resolve(self);
      } else {
        self.fetchEvidenceKeysAndProperties(resolve, reject);
      }
    });
  }

  /**
   * Internal process for cloud engine
   * Returns raw JSON as a "cloud" property in "cloud"
   *
   * @param {FlowData} flowData flowData to process
   * @returns {Promise} data from cloud service
   */
  processInternal (flowData) {
    const engine = this;
    return engine.getData(flowData);
  }

  /**
   * A response with a top level `fodid` member, in any case, holds a 51Did
   * created for the one request, so it is neither stored in the cache nor
   * served from it. The answer is worked out once for each element data,
   * so a cache hit does not parse the response again.
   *
   * @param {object} data the element data of a response
   * @returns {boolean} false if the response has a top level fodid member
   */
  isCacheable (data) {
    if (data === null || typeof data !== 'object') {
      return true;
    }
    let cacheable = cacheableData.get(data);
    if (cacheable === undefined) {
      cacheable = !holdsFodId(data);
      cacheableData.set(data, cacheable);
    }
    return cacheable;
  }

  /**
   * Typically, cloud will return errors as JSON.
   * However, transport level errors or other failures can result in
   * responses that are plain text. This function handles these cases.
   *
   * @param {string} responseBody the response data to process
   * @returns {Array} The error messages
   */
  getErrorMessages (responseBody) {
    let errors = [];
    try {
      errors = JSON.parse(responseBody).errors;
    } catch (parseError) {
      errors = ['Error parsing response - ' + responseBody];
    }
    if (responseBody.length === 0) {
      errors = ['No data in response from cloud service'];
    }
    return errors;
  }

  /**
   * Used to handle errors from http requests
   *
   * @param {import('http').ServerResponse} response Responce to get errors from
   * @returns {Array<CloudRequestError>} Array of CloudRequestError from response
   */
  getErrorsFromResponse (response) {
    let content = response;
    if (response.content) {
      content = response.content;
    }

    // The cloud's errors can name the license key it was sent, so the key
    // is masked before the text goes into an error.
    const licenseKey = this.licenseKey;
    const errors = this.getErrorMessages(content);
    const cloudErrors = [];
    errors.forEach(function (errorText) {
      cloudErrors.push(new CloudRequestError(
        LicenseKeys.mask(errorText, licenseKey),
        response.headers,
        response.statusCode));
    });

    if (cloudErrors.length === 0 &&
      response.statusCode > 299) {
      const message = 'Cloud service returned status code ' +
        response.statusCode + ' with content ' + content + '.';
      cloudErrors.push(new CloudRequestError(
        LicenseKeys.mask(message, licenseKey),
        response.headers,
        response.statusCode));
    }

    return cloudErrors;
  }

  /**
   * Internal process to fetch all the properties available under a resourcekey
   *
   * @returns {Promise<object>} properties from the cloud server
   */
  fetchProperties () {
    const engine = this;

    return new Promise(function (resolve, reject) {
      // A license key goes in the body of a POST rather than in the URL, so
      // it stays out of anything that logs the URL. A resource key on its
      // own goes in the query string.
      const url = engine.baseURL + 'accessibleproperties';
      let request;
      if (engine.licenseKey === '') {
        request = engine.requestClient.get(
          url + '?resource=' + engine.resourceKey,
          engine.cloudRequestOrigin);
      } else {
        const credentials = {};
        if (engine.resourceKey !== '') {
          credentials.resource = engine.resourceKey;
        }
        credentials.license = engine.licenseKey;
        request = engine.requestClient.post(
          url,
          credentials,
          engine.cloudRequestOrigin);
      }

      request
        .then(function (properties) {
          const propertiesOutput = {};

          properties = JSON.parse(properties);

          const products = properties.Products;

          for (const product in products) {
            propertiesOutput[product] = engine.propertiesTransform(
              products[product].Properties);
          }

          engine.flowElementProperties = propertiesOutput;
          resolve(propertiesOutput);
        }).catch(function (response) {
          reject(engine.getErrorsFromResponse(response));
        });
    });
  }

  /**
   * Properties transform
   *
   * @param {object} properties properties to transform
   * @returns {object} transformed properties
   */
  propertiesTransform (properties) {
    const result = {};
    const self = this;
    properties
      .forEach(function (property) {
        result[property
          .Name
          .toLowerCase()
        ] = {};
        for (const metaKey in property) {
          result[property.Name.toLowerCase()][metaKey.toLowerCase()] =
            self.metaPropertyTransform(
              metaKey.toLowerCase(),
              property[metaKey]);
        }
      });
    return result;
  }

  /**
   * Meta property transform
   *
   * @param {string} key key to check
   * @param {object} value properties to transform
   * @returns {object} transformed properties
   */
  metaPropertyTransform (key, value) {
    switch (key) {
      case 'itemproperties':
        return this.propertiesTransform(value);
      default:
        return value;
    }
  }

  /**
   * Internal function to get data from cloud service
   *
   * @param {FlowData} flowData
   * FlowData used to extract evidence and send to cloud service
   * for processing
   * @returns {Promise} result of processing
   */
  getData (flowData) {
    const engine = this;

    // A resource key names the route. A license key on its own has no
    // resource key to put there, so it uses the route that takes none.
    const url = this.resourceKey !== ''
      ? this.baseURL + this.resourceKey + '.json'
      : this.baseURL + sharedValues.licenseDataPath;

    const self = this;

    return new Promise(function (resolve, reject) {
      // The keys go in the body, the license key never in the URL. They and
      // the list are set after the evidence, so evidence cannot replace them.
      const content = engine.getContent(flowData);
      if (engine.resourceKey !== '') {
        content.resource = engine.resourceKey;
      }
      if (engine.licenseKey !== '') {
        content.license = engine.licenseKey;
      }
      if (engine.requestedProperties.length > 0) {
        content.values = engine.requestedProperties.join(',');
      }

      engine.requestClient.post(
        url,
        content,
        engine.cloudRequestOrigin)
        .then(function (body) {
          const data = new AspectDataDictionary({
            flowElement: engine,
            contents: {
              cloud: body,
              properties: engine.properties
            }
          });

          flowData.setElementData(data);
          engine.reportPropertiesNotCovered(flowData, body);

          resolve();
        }).catch(function (response) {
          self.errors = engine.getErrorsFromResponse(response);
          reject(self.errors);
        });
    });
  }

  /**
   * Compares the requested properties with an answer and logs, once, the
   * names the answer left out. The cloud service drops a property the keys
   * do not cover without naming it, so only the engine can notice. A
   * property present but null counts as answered, because its nullreason
   * says why it has no value. The answer cannot change while the keys and
   * the list stay the same, so one comparison is enough.
   *
   * @param {FlowData} flowData the flow data whose pipeline is logged to
   * @param {string} body the JSON the cloud service answered with
   */
  reportPropertiesNotCovered (flowData, body) {
    if (this.notCoveredReported || this.requestedProperties.length === 0) {
      return;
    }
    let answer;
    try {
      answer = JSON.parse(body);
    } catch (e) {
      return;
    }
    if (answer === null || typeof answer !== 'object') {
      return;
    }
    this.notCoveredReported = true;
    const notCovered = this.requestedProperties.filter(
      (name) => answerHolds(answer, name) === false);
    if (notCovered.length > 0) {
      // With no license key, the resource key's licence answers a property
      // it does not grant as null, so a name left out is not a property.
      const message = this.licenseKey === ''
        ? errorMessages.propertiesNotProperties
        : errorMessages.propertiesNotCovered;
      flowData.pipeline.log('warn', util.format(
        message, notCovered.join(', ')));
    }
  }

  /**
   * Internal function to get evidenceKeys used by cloud resourcekey
   *
   * @returns {Promise} evidence promise
   */
  getEvidenceKeys () {
    const engine = this;
    const url = this.baseURL + 'evidencekeys';
    return new Promise(function (resolve, reject) {
      engine.requestClient.get(url, engine.cloudRequestOrigin)
        .then(function (body) {
          engine.evidenceKeyFilter = new BasicListEvidenceKeyFilter(
            JSON.parse(body)
          );

          resolve();
        }).catch(function (response) {
          reject(engine.getErrorsFromResponse(response));
        });
    });
  }

  /**
   * Generate the Content to send in the POST request. One name under
   * several prefixes is sent once, with the value of the prefix that
   * evidence.md ranks highest, being query, header, cookie, server,
   * fiftyone and location, then any other prefix alphabetically. The
   * groups are added lowest precedence first, so a later value replaces
   * an earlier one.
   * 'query.' evidence should take precedence over all other evidence.
   * If there are evidence keys other than 'query.' that conflict then
   * this is unexpected so a warning will be logged.
   *
   * The engine sends every Evidence value in the Flow Data, including the
   * values no element in the pipeline accepts, because what the cloud
   * service uses changes over time and knowing about the other Evidence is
   * important to continued optimization. The reserved names and the web
   * request view are left out.
   *
   * @param {FlowData} flowData FlowData to get evidence from
   * @returns {object} Evidence Dictionary
   */
  getContent (flowData) {
    const queryData = {};

    const evidence = this.sendableEvidence(flowData.evidence);

    // Add the other evidence lowest precedence first.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'other'));
    // Add cookie evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'cookie'));
    // Add header evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'header'));
    // Add query evidence.
    this.addQueryData(flowData, queryData, evidence, this.getSelectedEvidence(evidence, 'query'));

    return queryData;
  }

  /**
   * The evidence the engine sends, being every value in the Flow Data,
   * whether an element accepted it or not, apart from the web request
   * view. addQueryData then leaves out the reserved names. The accepted
   * values come first, so where the two would give the same name the
   * accepted one is sent.
   *
   * @param {Evidence} evidence the Flow Data's evidence
   * @returns {object} the evidence keys and values to send
   */
  sendableEvidence (evidence) {
    const sendable = {};
    // An older fiftyone.pipeline.core throws unaccepted evidence away.
    const unaccepted = typeof evidence.getUnaccepted === 'function'
      ? evidence.getUnaccepted()
      : {};

    for (const source of [evidence.getAll(), unaccepted]) {
      for (const [key, value] of Object.entries(source)) {
        if (this.isSent(key) && hasOwn(sendable, key) === false) {
          sendable[key] = value;
        }
      }
    }

    return sendable;
  }

  /**
   * Whether an evidence key is sent to the cloud service. The reserved
   * names are left out later, by addQueryData.
   *
   * @param {string} key the evidence key
   * @returns {boolean} false for the web request view, in any letter case
   */
  isSent (key) {
    return String(key).toLowerCase() !== webRequestKey;
  }

  /**
   * Add query data to the evidence.
   *
   * @param {FlowData} flowData FlowData for logging
   * @param {object} queryData The destination dictionary to add query data to.
   * @param {Evidence} allEvidence All evidence in the flow data. This is used to
   * report which evidence keys are conflicting.
   * @param {object} evidence Evidence to add to the query Data.
   */
  addQueryData (flowData, queryData, allEvidence, evidence) {
    for (const [evidenceKey, evidenceValue] of Object.entries(evidence)) {
      // Split the key at its first dot only. The prefix is the part before
      // it and the name sent to the cloud is everything after it, so a name
      // that itself contains a dot, such as id.usage, is sent whole.
      const separatorIndex = evidenceKey.indexOf('.');
      const prefix = separatorIndex >= 0
        ? evidenceKey.substring(0, separatorIndex)
        : evidenceKey;
      const suffix = separatorIndex >= 0
        ? evidenceKey.substring(separatorIndex + 1)
        : evidenceKey;

      // Evidence never supplies the request's own fields.
      if (reservedFields.includes(suffix.toLowerCase())) {
        continue;
      }

      // Check and add the evidence to the query parameters.
      if (hasOwn(queryData, suffix) === false) {
        queryData[suffix] = evidenceValue;
      } else {
        // If the queryParameter exists already.
        // Get the conflicting pieces of evidence and then log a
        // warning, if the evidence prefix is not query. Otherwise a
        // warning is not needed as query evidence is expected
        // to overwrite any existing evidence with the same suffix.
        if (prefix.toLowerCase() !== 'query') {
          const conflicts = {};
          for (const [key, value] of Object.entries(allEvidence)) {
            if (key !== evidenceKey && key.includes(suffix)) {
              conflicts[key] = value;
            }
          }

          let conflictStr = '';
          for (const [key, value] of Object.entries(conflicts)) {
            if (conflictStr.length > 0) {
              conflictStr += ', ';
            }
            conflictStr += util.format('%s:%s', key, value);
          }

          const warningMessage = util.format(
            errorMessages.evidenceConflict,
            evidenceKey,
            evidenceValue,
            conflictStr);
          flowData.pipeline.log('warn', warningMessage);
        }
        // Overwrite the existing queryParameter value.
        queryData[suffix] = evidenceValue;
      }
    }
  }

  /**
   * Get evidence with specified prefix.
   *
   * @param {Evidence} evidence All evidence in the flow data.
   * @param {string} type Required evidence key prefix
   * @returns {Evidence} Selected evidence
   */
  getSelectedEvidence (evidence, type) {
    let selectedEvidence = {};

    if (type === 'other') {
      for (const [key, value] of Object.entries(evidence)) {
        if (this.hasKeyPrefix(key, 'query') === false &&
          this.hasKeyPrefix(key, 'header') === false &&
          this.hasKeyPrefix(key, 'cookie') === false) {
          selectedEvidence[key] = value;
        }
      }
      // Lowest precedence first, so the value added last wins.
      selectedEvidence = Object.keys(selectedEvidence)
        .sort((a, b) => compareOtherKeys(b, a))
        .reduce((obj, key) => {
          obj[key] = selectedEvidence[key];
          return obj;
        }, {});
    } else {
      for (const [key, value] of Object.entries(evidence)) {
        if (this.hasKeyPrefix(key, type)) {
          selectedEvidence[key] = value;
        }
      }
    }
    return selectedEvidence;
  }

  /**
   * Check that the key of a KeyValuePair has the given prefix, ignoring
   * letter case as evidence keys do.
   *
   * @param {string} itemKey Key to check
   * @param {string} prefix The prefix to check for.
   * @returns {boolean} True if the key has the prefix.
   */
  hasKeyPrefix (itemKey, prefix) {
    return itemKey.toLowerCase().startsWith(prefix.toLowerCase() + '.');
  }
}

/**
 * Reads a key setting.
 *
 * @param {*} value a key setting
 * @returns {string} the key as given, or an empty string where it is
 * absent, empty or only whitespace
 */
function keyText (value) {
  if (value === undefined || value === null) {
    return '';
  }
  const text = String(value);
  return text.trim() === '' ? '' : text;
}

/**
 * Reads the requested properties setting.
 *
 * @param {Array<string>|string|undefined} value property names as a list
 * or one comma separated string
 * @returns {Array<string>} the names, trimmed, leaving out empty ones
 */
function propertyNames (value) {
  if (value === undefined || value === null) {
    return [];
  }
  const names = typeof value === 'string' ? value.split(',') : value;
  return names
    .map((name) => String(name).trim())
    .filter((name) => name !== '');
}

/**
 * Finds a key of an object, ignoring case, because the cloud service
 * lower-cases the names in its answer.
 *
 * @param {object} object the object to search
 * @param {string} name the name wanted
 * @returns {string|undefined} the key as the object spells it
 */
function findKey (object, name) {
  const lower = name.toLowerCase();
  return Object.keys(object).find((key) => key.toLowerCase() === lower);
}

/**
 * Whether an answer holds a property.
 *
 * @param {object} answer the parsed answer from the cloud service
 * @param {string} name a fully qualified name such as device.ismobile
 * @returns {boolean} true when the property is present, even as null
 */
function answerHolds (answer, name) {
  const separator = name.indexOf('.');
  if (separator < 0) {
    return false;
  }
  const sectionKey = findKey(answer, name.substring(0, separator));
  if (sectionKey === undefined) {
    return false;
  }
  const section = answer[sectionKey];
  return section !== null && typeof section === 'object' &&
    findKey(section, name.substring(separator + 1)) !== undefined;
}

/**
 * Refuses the two combinations the cloud service refuses on every request,
 * so a deployment sees one error when the engine is built rather than a
 * failure on each request.
 *
 * @param {CloudRequestEngine} engine the engine being built
 */
function refuseInvalidCredentials (engine) {
  if (engine.resourceKey === '' && engine.licenseKey === '') {
    throw new Error(errorMessages.noCredential);
  }
  if (engine.resourceKey === '' && engine.requestedProperties.length === 0) {
    throw new Error(errorMessages.licenseKeyNeedsProperties);
  }
}

// The prefixes after query, header and cookie, highest precedence first, as
// evidence.md lists them. Any other prefix ranks after these, alphabetically.
const OTHER_PREFIX_PRECEDENCE = ['server', 'fiftyone', 'location'];

/**
 * The prefix of an evidence key in lower case, being the text before the
 * first dot, or the whole key where there is no dot.
 *
 * @param {string} key the evidence key
 * @returns {string} the prefix
 */
function keyPrefix (key) {
  const separatorIndex = key.indexOf('.');
  return (separatorIndex >= 0 ? key.substring(0, separatorIndex) : key)
    .toLowerCase();
}

/**
 * Compares two evidence keys that are not query, header or cookie evidence
 * by precedence. server, fiftyone and location come first, in the order
 * evidence.md lists them, then any other prefix alphabetically, all
 * ignoring letter case.
 *
 * @param {string} a the first evidence key
 * @param {string} b the second evidence key
 * @returns {number} negative where a has the higher precedence
 */
function compareOtherKeys (a, b) {
  const prefixA = keyPrefix(a);
  const prefixB = keyPrefix(b);
  const rank = prefix => {
    const index = OTHER_PREFIX_PRECEDENCE.indexOf(prefix);
    return index >= 0 ? index : OTHER_PREFIX_PRECEDENCE.length;
  };
  const byRank = rank(prefixA) - rank(prefixB);
  if (byRank !== 0) {
    return byRank;
  }
  if (prefixA !== prefixB) {
    return prefixA < prefixB ? -1 : 1;
  }
  const lowerA = a.toLowerCase();
  const lowerB = b.toLowerCase();
  return lowerA < lowerB ? -1 : (lowerA > lowerB ? 1 : 0);
}

module.exports = CloudRequestEngine;
