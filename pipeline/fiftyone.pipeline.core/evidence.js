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

const url = require('url');
const Constants = require('./constants');

const formContentType = 'application/x-www-form-urlencoded';

/**
 * The path and the query string of a request line's target, undecoded and
 * byte for byte as the request line carried them, being what comes before
 * and after the first question mark and, when the target is a full URL,
 * after its host. The query is empty where the target carries none.
 *
 * @param {*} target the request target, such as /page?a=1
 * @returns {{path: string, query: string}} the two parts
 */
const requestLineParts = function (target) {
  const text = typeof target === 'string' ? target : '';
  const withoutScheme = text.replace(/^[a-z][a-z0-9+.-]*:\/\/[^/?#]*/i, '');
  const mark = withoutScheme.indexOf('?');
  if (mark < 0) {
    return { path: withoutScheme, query: '' };
  }
  return {
    path: withoutScheme.substring(0, mark),
    query: withoutScheme.substring(mark + 1)
  };
};

/**
 * Whether the request is a POST whose body is a form.
 *
 * @param {object} request an HTTP request object
 * @returns {boolean} true for a POST with a form content type
 */
const isFormPost = function (request) {
  if (typeof request.method !== 'string' ||
    request.method.toUpperCase() !== 'POST' ||
    !request.headers) {
    return false;
  }
  const name = Object.keys(request.headers)
    .find(key => key.toLowerCase() === 'content-type');
  const contentType = name === undefined ? undefined : request.headers[name];
  return typeof contentType === 'string' &&
    contentType.toLowerCase().startsWith(formContentType);
};

/**
 * The name and value pairs of a form body, with the values of a repeated
 * name joined by commas as the .NET web integration joins them.
 *
 * @param {object|string|Buffer} body the parsed form or the body text
 * @returns {Array<Array<string>>} the name and value pairs
 */
const formEntries = function (body) {
  if (typeof body === 'string' || Buffer.isBuffer(body)) {
    const params = new URLSearchParams(body.toString());
    return [...new Set(params.keys())]
      .map(name => [name, params.getAll(name).join(',')]);
  }
  if (typeof body === 'object') {
    return Object.entries(body).map(([name, value]) =>
      [name, Array.isArray(value) ? value.join(',') : value]);
  }
  return [];
};

/**
 * Read a form body from a request into request.body, unless the request is
 * not a form POST, something has read the body already, or the body is
 * larger than the limit.
 *
 * @param {object} request an HTTP request object
 * @param {number} maxBytes the largest body read
 * @returns {Promise<void>} resolves once the body has been read
 */
const readFormBody = function (request, maxBytes) {
  return new Promise((resolve, reject) => {
    if (!isFormPost(request) ||
      request.body !== undefined ||
      typeof request.on !== 'function' ||
      request.readableEnded === true) {
      resolve();
      return;
    }
    const chunks = [];
    let length = 0;
    let tooLarge = false;
    request.on('data', chunk => {
      length += chunk.length;
      if (length > maxBytes) {
        tooLarge = true;
      } else if (tooLarge === false) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
    });
    request.on('end', () => {
      if (tooLarge === false) {
        request.body = Buffer.concat(chunks).toString('utf8');
      }
      resolve();
    });
    request.on('error', reject);
  });
};

/**
 * @typedef {import('./flowData')} FlowData
 */

/**
 * Storage of evidence on a flowData object
 */
class Evidence {
  /**
   * Constructor for evidence
   *
   * @param {FlowData} flowData FlowData to add the evidence to
   */
  constructor (flowData) {
    this.flowData = flowData;
    this.evidenceStore = {};
    // The key each value is held under in evidenceStore, by that key in
    // lower case. Evidence keys ignore letter case, so a key added again in
    // other letters replaces the value and keeps the letters it was first
    // added with.
    this.keys = Object.create(null);
    this.unacceptedStore = {};
    /**
     * The web request as server.http-request holds it, being every value
     * addFromRequest read from the request, under its evidence key and
     * before any is filtered out, or undefined when evidence was not added
     * from a request.
     *
     * @type {Readonly<object>|undefined}
     */
    this.httpRequest = undefined;
  }

  /**
   * Add a piece of evidence to flowData. Keys ignore letter case, so a key
   * that differs from one already added only in its letters replaces that
   * value under the letters it was first added with. A key is kept when an
   * element accepts it or keeps it. server.http-request is always kept,
   * apart from the other evidence, because it is the web request rather
   * than a value to process.
   *
   * @param {string} key evidence key to add
   * @param {*} value value of evidence key
   */
  add (key, value) {
    const folded = String(key).toLowerCase();
    if (folded === Constants.evidenceHttpRequest) {
      this.httpRequest = value;
      return;
    }
    if (Object.prototype.hasOwnProperty.call(this.keys, folded)) {
      key = this.keys[folded];
    }

    // Keep the evidence no element in the pipeline accepts apart from the
    // rest, so an element that needs it can still reach it through
    // getUnaccepted. getAll stays the accepted evidence alone, which is
    // what an engine's cache key and usage sharing read. Both stores are
    // keyed through the same table, so two spellings of one key are one
    // entry in either.

    let keep;

    for (let flowElement in this.flowData.pipeline.flowElements) {
      flowElement = this.flowData.pipeline.flowElements[flowElement];

      if (flowElement.evidenceKeyFilter.filterEvidenceKey(key) ||
        (flowElement.keptEvidenceKeyFilter &&
          flowElement.keptEvidenceKeyFilter.filterEvidenceKey(key))) {
        keep = true;
      }
    }

    if (keep) {
      this.flowData.pipeline.log('debug', key + ' added to evidence');

      this.keys[folded] = key;
      delete this.unacceptedStore[key];
      this.evidenceStore[key] = value;
    } else {
      this.flowData.pipeline.log(
        'debug',
        key + ' not accepted by any element. Set aside.'
      );

      this.keys[folded] = key;
      delete this.evidenceStore[key];
      this.unacceptedStore[key] = value;
    }
  }

  /**
   * Add a piece of evidence to flowData as an object
   *
   * @param {object} evidenceObject key value map of evidence
   * @param {string} evidenceObject.key evidencekey
   * @param {*} evidenceObject.value evidence value
   */
  addObject (evidenceObject) {
    const evidenceContainer = this;

    Object.keys(evidenceObject).forEach(function (key) {
      evidenceContainer.add(key, evidenceObject[key]);
    });
  }

  /**
   * Add evidence to flowData from an HTTP request
   * This helper automatically adds evidence:
   * headers, cookies, session values, protocol, IP, query params and, for a
   * POST with a form body, the form values.
   *
   * Form values are added as query evidence after the query string, so a
   * form value replaces a query string value of the same name. They are
   * read from request.body, which a framework's form parser sets, either as
   * an object or as the body text. A plain Node request has no request.body,
   * so use addFromRequestAsync to read the body from the request instead.
   * The 51Degrees client script sends its values in a form body, so without
   * one or the other they never reach the pipeline.
   *
   * The web request is also added as server.http-request, whether or not an
   * element accepts it, as a frozen object holding every value read from
   * the request under the key it has as evidence, with the request line as
   * server.request-method, server.request-path and server.request-query.
   * It is there
   * for elements that read the request without accepting evidence, such as
   * the usage sharing element, and so that what the request carried can be
   * used once processing is done, when the request's socket may have
   * closed.
   *
   * @param {object} request an HTTP request object
   * @returns {Evidence} return updated evidence
   */
  addFromRequest (request) {
    // Every value read from the request, in order, so that a later value
    // for a key replaces an earlier one, as add does.
    const values = [];
    const evidence = {
      add: (key, value) => values.push([key, value])
    };

    // Process headers

    Object.keys(request.headers).forEach(key => {
      const value = request.headers[key];
      let requestHeaderKey;
      let requestHeaderValue;

      if (key !== 'cookie') {
        requestHeaderKey = 'header' + '.' + key;

        requestHeaderValue = value;

        evidence.add(requestHeaderKey, requestHeaderValue);
      } else {
        value.split(';').forEach((cookie) => {
          const parts = cookie.split('=');

          requestHeaderKey = 'cookie' + '.' + parts.shift().trim();

          requestHeaderValue = decodeURI(parts.join('='));

          evidence.add(requestHeaderKey, requestHeaderValue);
        });
      }
    });

    // Add protocol

    evidence.add(
      'header.protocol',
      request.connection.encrypted ? 'https' : 'http'
    );

    // Use referer header to set protocol if set

    if (request.headers.referer) {
      evidence.add(
        'header.protocol',
        new url.URL(request.headers.referer).protocol.replace(':', '')
      );
    }

    // Add IP address

    evidence.add(
      'server.client-ip',
      request.connection.remoteAddress.toString()
    );

    evidence.add('server.host-ip', request.connection.localAddress.toString());

    // Parsing URL using new URL constructor

    const protocol = request.protocol || 'http';
    const hostname = request.hostname || 'localhost'; // Use a default hostname if not available
    const port = request.socket?.localPort || ''; // Port may not be available in some cases

    // If request.url already contains the protocol, hostname, and port, use it as is
    const fullURL = request.url.includes('://') ? request.url : `${protocol}://${hostname}${port ? `:${port}` : ''}${request.url}`;

    // Get querystring data

    const URL = new url.URL(fullURL);
    const query = URL.searchParams;

    query.forEach(function (value, param) {
      evidence.add('query.' + param, value);
    });

    // Add form values, after the query string so that they replace it.
    if (isFormPost(request) && request.body !== undefined &&
      request.body !== null) {
      for (const [name, value] of formEntries(request.body)) {
        evidence.add('query.' + name, value);
      }
    }

    // Add the values stored in the session, when the request has one. The
    // session's own settings, such as an expiry, are not values.
    if (request.session !== null && typeof request.session === 'object') {
      for (const [name, value] of Object.entries(request.session)) {
        if (['string', 'number', 'boolean'].includes(typeof value)) {
          evidence.add('session.' + name, value);
        }
      }
    }

    const httpRequest = {};
    for (const [key, value] of values) {
      this.add(key, value);
      httpRequest[key] = value;
    }

    // The request line is part of the request as well, exactly as the
    // request line has it. All three values are always on the view, with
    // the query empty where there was none, so an absent key says the
    // request line was not supplied rather than that it had no query.
    const requestLine = requestLineParts(request.url);
    httpRequest['server.request-method'] =
      typeof request.method === 'string' ? request.method : '';
    httpRequest['server.request-path'] = requestLine.path;
    httpRequest['server.request-query'] = requestLine.query;
    this.add(Constants.evidenceHttpRequest, Object.freeze(httpRequest));

    return this;
  }

  /**
   * Add evidence to flowData from an HTTP request, first reading a form
   * body from the request when it is a POST with a form body and nothing
   * has read the body already. The body text is kept in request.body, and
   * then addFromRequest adds the evidence. A body larger than
   * maxFormBytes is not read and no form values are added.
   *
   * @param {object} request an HTTP request object
   * @param {number} [maxFormBytes] the largest form body read, one
   * mebibyte unless given
   * @returns {Promise<Evidence>} the updated evidence
   */
  addFromRequestAsync (request, maxFormBytes = 1024 * 1024) {
    return readFormBody(request, maxFormBytes)
      .then(() => this.addFromRequest(request));
  }

  /**
   * Get a piece of evidence by key, in any letter case
   *
   * @param {string} key evidence key to retreive
   * @returns {*} the evidence value, or undefined where there is none
   */
  get (key) {
    const folded = String(key).toLowerCase();
    if (folded === Constants.evidenceHttpRequest) {
      return this.httpRequest;
    }
    // The table also holds the set aside keys, which get does not read.
    const stored = this.keys[folded];
    return stored !== undefined &&
      Object.prototype.hasOwnProperty.call(this.evidenceStore, stored)
      ? this.evidenceStore[stored]
      : undefined;
  }

  /**
   * Get all evidence. server.http-request is left out, because it is the web
   * request rather than a value to process, so get it with get.
   *
   * @returns {object} all evidence
   */
  getAll () {
    return this.evidenceStore;
  }

  /**
   * Get the evidence no element in the pipeline accepts, which add set
   * aside rather than throwing away. The Cloud Request Engine sends it
   * along with the accepted evidence, because what the cloud service uses
   * changes over time.
   *
   * @returns {object} the evidence set aside, empty where every key was
   * accepted
   */
  getUnaccepted () {
    return this.unacceptedStore;
  }
}

module.exports = Evidence;
