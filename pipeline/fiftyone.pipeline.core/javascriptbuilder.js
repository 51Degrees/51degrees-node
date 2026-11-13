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

const mustache = require('mustache');
const fs = require('fs');
const path = require('path');

const template = fs.readFileSync(
  path.resolve(__dirname, 'javascript-templates', 'JavaScriptResource.mustache'),
  'utf8'
);

const FlowElement = require('./flowElement.js');
const EvidenceKeyFilter = require('./evidenceKeyFilter.js');
const ElementDataDictionary = require('./elementDataDictionary.js');
const Constants = require('./constants.js');
const callbackUrl = require('./callbackUrl.js');
const uglifyJS = require('uglify-js');

// Evidence names the rendered script is not configured with. The script
// appends both to its own request itself, so naming them here as well would
// send each twice and, worse, put the session id into the record the script
// keeps of a request's inputs. That record decides whether a later page view
// in the same tab can be served from the cached response, and a session id is
// different on every page view, so a record holding one could never match.
// The same two are excluded by the .NET builder, which is the reference for
// this behaviour.
const excludedParameters = ['session-id', 'sequence'];

// The object name is written into the script as the name of a global
// variable, as a session storage key and inside string literals, with no
// escaping of JavaScript. A name that is not a plain JavaScript identifier
// would therefore break the script or change what it does, so only names
// matching this pattern are used.
const objectNamePattern = /^[A-Za-z_$][A-Za-z0-9_$]*$/;

// The name used where no name is configured, meaning the option is absent
// or null. A configured name that is not valid, an empty one included, is
// refused instead.
const defaultObjectName = 'fod';

// Words the pattern accepts that cannot be the name of the object. These are
// the reserved words of the language, including those reserved only in
// strict mode, then eval and arguments, which strict mode code cannot
// declare and of which eval would replace the page's own eval function, then
// the three global values and the properties of the browser's Window object
// that a top level var cannot replace, so the object would never be created,
// and location, where a top level var navigates the page away. The last
// entry is the constructor the script itself defines and calls to create the
// object, so that name would clash with it.
const reservedObjectNames = [
  'await', 'break', 'case', 'catch', 'class', 'const', 'continue',
  'debugger', 'default', 'delete', 'do', 'else', 'enum', 'export',
  'extends', 'false', 'finally', 'for', 'function', 'if', 'implements',
  'import', 'in', 'instanceof', 'interface', 'let', 'new', 'null',
  'package', 'private', 'protected', 'public', 'return', 'static', 'super',
  'switch', 'this', 'throw', 'true', 'try', 'typeof', 'var', 'void',
  'while', 'with', 'yield', 'Infinity', 'NaN', 'undefined',
  'eval', 'arguments',
  'window', 'document', 'top', 'name', 'status', 'history', 'navigator',
  'closed', 'location', 'frameElement', 'isSecureContext',
  'crossOriginIsolated', 'trustedTypes', 'crypto', 'indexedDB',
  'localStorage', 'sessionStorage', 'caches', 'cookieStore',
  'speechSynthesis', 'styleMedia', 'crashReport', 'credentialless',
  'customElements', 'documentPictureInPicture', 'fence', 'launchQueue',
  'originAgentCluster',
  'fiftyoneDegreesManager'
];

/**
 * Whether a name can be used as the name of the client side object.
 *
 * @param {*} name the requested name
 * @returns {boolean} true if the name is a valid JavaScript identifier and
 * not a reserved word
 */
function isValidObjectName (name) {
  return typeof name === 'string' &&
    objectNamePattern.test(name) &&
    reservedObjectNames.indexOf(name) === -1;
}

// The session id is written into the script inside double quotes with no
// escaping, so only a value of 1 to 64 ASCII letters, digits and hyphens is
// written. Any other value could break the script or change what it does.
// The id the Sequence Element creates always matches.
const sessionIdPattern = /^[A-Za-z0-9-]{1,64}$/;

// A sequence given as text is only read when it is made of digits, and one
// of more than ten digits cannot be a 32 bit integer.
const sequencePattern = /^[0-9]{1,10}$/;

const maxSequence = 2147483647;

/**
 * The session id to write into the script, which is the value given when it
 * is safe to write and an empty string otherwise.
 *
 * @param {*} value the session id evidence
 * @returns {string} the session id, or an empty string
 */
function safeSessionId (value) {
  return typeof value === 'string' && sessionIdPattern.test(value)
    ? value
    : '';
}

/**
 * The sequence to write into the script, which is the value given when it is
 * a positive 32 bit integer and 1 otherwise, including where there is no
 * Sequence Element. The value is written as code, so text that is not a
 * number could break the script, and a number below 1 is not a sequence the
 * Sequence Element would ever give.
 *
 * @param {*} value the sequence evidence
 * @returns {number} the sequence, which is always at least 1
 */
function safeSequence (value) {
  let sequence = 0;
  if (typeof value === 'number') {
    sequence = value;
  } else if (typeof value === 'string' && sequencePattern.test(value)) {
    sequence = Number(value);
  }
  return Number.isInteger(sequence) &&
    sequence >= 1 &&
    sequence <= maxSequence
    ? sequence
    : 1;
}

/**
 * Encode a parameter name or value the way the .NET builder does with
 * WebUtility.UrlEncode, which is the reference. The script joins the
 * rendered parameters into its request body as they stand, so they must be
 * encoded here. The differences from encodeURIComponent are that a space
 * becomes a plus sign and that a tilde and an apostrophe are encoded too.
 *
 * @param {*} value the name or value to encode
 * @returns {string} the encoded text
 */
const urlEncode = function (value) {
  return encodeURIComponent(String(value))
    .replace(/[~']/g, c => '%' + c.charCodeAt(0).toString(16).toUpperCase())
    .replace(/%20/g, '+');
};

/**
 * Text quoted for a log message, with the control characters and the line
 * and paragraph separators escaped so that it cannot start a new log line.
 *
 * @param {string} text the text to quote
 * @returns {string} the quoted text
 */
function quotedForLog (text) {
  return JSON.stringify(text).replace(
    /[\u007f-\u009f\u2028\u2029]/g,
    c => '\\u' + c.charCodeAt(0).toString(16).padStart(4, '0'));
}

/**
 * @typedef {import('./flowData')} FlowData
 */

/**
 * The script reads the query string, and the host and protocol it calls
 * back to, so those are the evidence that can change it.
 */
class JSEvidenceKeyFilter extends EvidenceKeyFilter {
  filterEvidenceKey (key) {
    // Evidence keys ignore letter case.
    const lower = String(key).toLowerCase();
    return lower.startsWith('query.') ||
      lower === 'header.host' ||
      lower === 'header.protocol';
  }
}

/**
 * The JavaScriptBuilder aggregates JavaScript properties
 * from FlowElements in the pipeline. This JavaScript also
 * (when needed) generates a fetch request to retrieve additional properties
 * populated with data from the client side
 * It depends on the JSON Bundler element
 * (both are automatically added to a pipeline unless
 * specifically removed) for its list of properties.
 * The results of the JSON Bundler should also be used in a
 * user-specified endpoint which retrieves the JSON from the
 * client side. The JavaScriptBuilder is constructed with a
 * url for this endpoint.
 */
class JavaScriptBuilderElement extends FlowElement {
  /**
   * Constructor for JavaScriptBuilder.
   *
   * @param {object} options options object
   * @param {string} options.objName the name of the client
   * side object with the JavaScript properties in it. This must be a valid
   * JavaScript identifier that is not a reserved word, or the constructor
   * throws. Leaving it out, or giving null, means "fod". This can be overridden with "query.fod-js-object-name" evidence,
   * which is ignored with a warning when it is not a valid name.
   * @param {string} options.protocol The protocol of the client side
   * callback url, http or https in any case of its ASCII letters. The
   * constructor throws for any other protocol. Left out, the header.protocol
   * evidence is used, or https when there is none
   * @param {string} options.host The host of the client side
   * callback url. This can be overriden with header.host evidence.
   * @param {string} options.endPoint The endpoint of the client side
   * callback url
   * @param {boolean} options.enableCookies Whether the client JavaScript
   * stored results of client side processing in cookies. This can also
   * be set per request, using the "query.fod-js-enable-cookies" evidence key.
   * For more details on personal data policy, see https://51degrees.com/terms/client-services-privacy-policy/?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core-javascriptbuilder.js&utm_term=constructor
   * @param {boolean} options.minify Whether to minify the JavaScript
   */
  constructor ({
    objName = defaultObjectName,
    protocol = '',
    host = '',
    endPoint = '',
    enableCookies = true,
    minify = false
  } = {}) {
    super(...arguments);

    // A name of null is no name at all, the same as leaving the option out.
    if (objName === null) {
      objName = defaultObjectName;
    }
    if (!isValidObjectName(objName)) {
      throw new Error(
        'JavaScriptBuilder objName is invalid. It must be a valid ' +
        'JavaScript identifier that is not a reserved word.');
    }

    // A protocol given here is used for every request, so one the script
    // cannot send its request with is refused now rather than logged on the
    // first request.
    const protocolIsValid = typeof protocol === 'string' &&
      callbackUrl.isScheme(protocol);
    if (protocol && !protocolIsValid) {
      throw new Error(
        'JavaScriptBuilder protocol is invalid. It must be http or https.');
    }

    this.settings = {
      objName,
      protocol,
      host,
      endPoint,
      enableCookies,
      minify
    };

    this.dataKey = 'javascriptbuilder';
    this.evidenceKeyFilter = new JSEvidenceKeyFilter();

    // Set once a callback URL that is not valid has been logged, because a
    // misconfigured element would otherwise log on every request.
    this._invalidUrlLogged = false;
  }

  /**
   * Internal process function of the JavaScript builder
   * Gets JSON from the JSONBundler and constructs JavaScript
   * to place on the client side
   *
   * @param {FlowData} flowData to process
   * @returns {undefined}
   */
  processInternal (flowData) {
    // Get output of jsonbuilder

    const json = flowData.jsonbundler.json;

    const settings = { _jsonObject: JSON.stringify(json) };

    for (const setting in this.settings) {
      settings['_' + setting] = this.settings[setting];
    }

    // Generate url from parts
    let protocol = this.settings.protocol;
    let host = this.settings.host;

    if (!protocol) {
      // Check if protocol is provided in evidence
      if (flowData.evidence.get('header.protocol')) {
        protocol = flowData.evidence.get('header.protocol');
      }
    }
    if (!protocol) {
      protocol = 'https';
    }

    if (!host) {
      // Check if host is provided in evidence
      if (flowData.evidence.get('header.host')) {
        host = flowData.evidence.get('header.host');
      }
    }

    settings._host = host;
    settings._protocol = protocol;

    // The URL is the protocol, the host and the endpoint and nothing else,
    // as the .NET builder renders it, and callbackUrl checks it. The values
    // the page was requested with go in the request body as the parameters
    // below, so none of them, the visitor's User-Agent and address included,
    // are written into a URL that servers and proxies log.
    const url = callbackUrl(protocol, host, settings._endPoint);
    if (url !== null && url.valid === false && !this._invalidUrlLogged) {
      this._invalidUrlLogged = true;
      this._log('error',
        'The generated URL ' + quotedForLog(url.url) + ' is not valid, so ' +
        'the JavaScript has no callback URL. Check the JavaScript ' +
        "builder's protocol, host and endpoint, and the protocol and host " +
        'evidence. This is reported once.');
    }

    // The parameters are the query evidence, each named by everything after
    // the first dot of its key so that a name such as id.usage is kept whole,
    // and leaving out the two the script appends itself. The script joins
    // them into its request body as they stand, so each name and value is
    // encoded here. They are written with or without a callback URL, as the
    // script reads them either way.
    const evidence = this.evidenceKeyFilter.filterEvidence(
      flowData.evidence.getAll()
    );
    const scriptParameters = {};
    for (const key in evidence) {
      if (key.startsWith('query.')) {
        const name = key.substring('query.'.length);
        if (excludedParameters.indexOf(name) === -1) {
          scriptParameters[urlEncode(name)] = urlEncode(evidence[key]);
        }
      }
    }
    settings._parameters = JSON.stringify(scriptParameters);

    if (url !== null && url.valid) {
      settings._url = url.url;
      settings._updateEnabled = true;
    } else {
      settings._updateEnabled = false;
    }

    // Use results from device detection if available to determine
    // if the browser supports promises.

    let promises;
    try {
      promises = flowData.device !== undefined &&
        flowData.device.promise !== undefined &&
        flowData.device.promise.hasValue === true &&
        flowData.device.promise.value === true;
    } catch (e) {
      promises = false;
    }
    settings._supportsPromises = promises;

    settings._hasDelayedProperties = settings._jsonObject.includes('delayexecution');

    settings._sessionId =
      safeSessionId(flowData.evidence.get('query.session-id'));
    settings._sequence =
      safeSequence(flowData.evidence.get('query.sequence'));

    // Try and get the requested enable cookies from evidence.
    const enableCookies = flowData.evidence.get(Constants.evidenceEnableCookies);
    if (enableCookies !== undefined) {
      settings._enableCookies = (enableCookies?.toLowerCase?.() === 'true');
    }
    // Try and get the requested object name from evidence. A name that is
    // not a valid identifier is ignored and the configured name is used.
    const objName = flowData.evidence.get(Constants.evidenceObjectName);
    if (objName !== undefined) {
      if (isValidObjectName(objName)) {
        settings._objName = objName;
      } else {
        this._log('warn',
          'The requested JavaScript object name is not a valid JavaScript ' +
          'identifier, so the configured name "' + this.settings.objName +
          '" was used instead.');
      }
    }

    let output = mustache.render(template, settings);

    if (settings._minify) {
      const minified = uglifyJS.minify(output);
      if (minified.error === null) {
        output = minified.code;
      }
    }

    const data = new ElementDataDictionary({
      flowElement: this,
      contents: { javascript: output }
    });

    flowData.setElementData(data);
  }
}

module.exports = JavaScriptBuilderElement;
