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

const crypto = require('crypto');
const Constants = require('./constants');

/**
 * @typedef {import('./flowData')} FlowData
 */

// How long a browser may reuse a client-side response before it asks again.
const DEFAULT_MAX_AGE_SECONDS = 1800;

// A response to a request whose processing recorded errors may be kept, but
// only used again once the server has been asked, and it carries no ETag, so
// the next request gets a full response rather than a 304 that keeps it.
const CACHE_CONTROL_AFTER_ERRORS = 'private, no-cache';

// Request headers that say how to answer rather than what to answer, being
// the preconditions of RFC 9110 section 13.1 and the cache directives of
// RFC 9111 sections 5.2.1 and 5.4. They take no part in the ETag, or a
// revalidation, which sends If-None-Match, would never match. They are named
// here because an element can accept every key, as the JavaScript builder
// does for the query string and the cloud request engine does until the
// cloud service's keys arrive.
const NOT_IN_ETAG = [
  'header.if-match',
  'header.if-none-match',
  'header.if-modified-since',
  'header.if-unmodified-since',
  'header.if-range',
  'header.cache-control',
  'header.pragma'
];

/**
 * The ETag for the evidence a request carries, the same in every process.
 * It is built from what addFromRequest read from the request, which it
 * keeps as server.http-request, rather than the flow data's evidence,
 * because processing adds evidence of its own, such as the new session id
 * the sequence element makes for each request without one, which would give
 * every response a different ETag. Evidence added by hand has no such
 * record, so its ETag is built from the flow data's evidence. Only the
 * evidence an element accepts is hashed, so evidence kept for an element
 * that does not accept it, such as the usage sharing element, takes no
 * part. It is weak, because the response can change for the same evidence,
 * for example when a data file is updated, and RFC 9110 section 8.8.3 asks
 * for such a validator to be marked weak.
 *
 * @param {FlowData} flowData the flow data for the request
 * @returns {string} the ETag
 */
const clientSideETag = function (flowData) {
  const evidence = flowData.evidence.get(Constants.evidenceHttpRequest) ||
    flowData.evidence.getAll();
  const elements = Object.values(flowData.pipeline.flowElements);
  const hash = crypto.createHash('sha256');
  for (const key of Object.keys(evidence).sort()) {
    if (NOT_IN_ETAG.includes(key.toLowerCase()) ||
      elements.some((element) =>
        element.evidenceKeyFilter.filterEvidenceKey(key)) === false) {
      continue;
    }
    hash.update(key + '\0' + String(evidence[key]) + '\0');
  }
  return 'W/"' + hash.digest('hex').substring(0, 32) + '"';
};

/**
 * The HTTP headers the pipeline's elements read evidence from, for the Vary
 * header. Only an element that lists its evidence keys names any.
 *
 * @param {FlowData} flowData the flow data
 * @returns {string} the header names, comma separated
 */
const clientSideVary = function (flowData) {
  const names = [];
  for (const element of Object.values(flowData.pipeline.flowElements)) {
    const list = element.evidenceKeyFilter && element.evidenceKeyFilter.list;
    for (const key of Array.isArray(list) ? list : []) {
      const lower = String(key).toLowerCase();
      if (lower.startsWith('header.') && lower.length > 'header.'.length &&
        names.includes(lower.substring('header.'.length)) === false) {
        names.push(lower.substring('header.'.length));
      }
    }
  }
  return names.sort().join(', ');
};

/**
 * Whether an If-None-Match header value matches an ETag, by the weak
 * comparison RFC 9110 section 13.1.2 asks for.
 *
 * @param {string} ifNoneMatch the header value
 * @param {string} etag the ETag of the response
 * @returns {boolean} true when it matches
 */
const ifNoneMatchMatches = function (ifNoneMatch, etag) {
  if (typeof ifNoneMatch !== 'string') {
    return false;
  }
  if (ifNoneMatch.trim() === '*') {
    return true;
  }
  const opaque = (tag) => tag.replace(/^W\//, '');
  const tags = ifNoneMatch.match(/(W\/)?"[^"]*"/g) || [];
  return tags.some((tag) => opaque(tag) === opaque(etag));
};

class Helpers {
  /**
   * Set response headers in the response object (e.g. Accept-CH)
   *
   * @param {import('http').ServerResponse} response The response to set the headers in.
   * @param {FlowData} flowData A processed FlowData instance to get the response header values
   * from.
   */
  static setResponseHeaders (response, flowData) {
    for (const [key, value] of Object.entries(flowData['set-headers'].responseheadersdictionary)) {
      if (response.hasHeader(key)) {
        response.setHeader(key, `${response.getHeader(key)},${value}`);
      } else {
        response.setHeader(key, value);
      }
    }
  }

  /**
   * Write the response of a client-side endpoint, the JSON endpoint or the
   * JavaScript endpoint, with the caching headers of the web integration
   * specification. A request whose If-None-Match matches the ETag gets a 304
   * when it is a GET or HEAD and a 412 otherwise, as RFC 9110 section 13.1.2
   * requires. A response to a request whose processing recorded errors has
   * Cache-Control private, no-cache and no ETag, though a matching
   * If-None-Match still gets its 304.
   *
   * @param {import('http').IncomingMessage} request the request
   * @param {import('http').ServerResponse} response the response, which this
   * ends
   * @param {FlowData} flowData the processed flow data for the request
   * @param {string} contentType the content type of the body
   * @param {string} body the JSON or the JavaScript
   * @param {object} [options] options
   * @param {number} [options.maxAgeSeconds] how long a browser may reuse the
   * response, 1800 unless given
   */
  static writeClientSideResponse (
    request, response, flowData, contentType, body, options = {}) {
    const maxAgeSeconds = options.maxAgeSeconds === undefined
      ? DEFAULT_MAX_AGE_SECONDS
      : options.maxAgeSeconds;
    const failed = Object.keys(flowData.errors || {}).length > 0;
    const etag = clientSideETag(flowData);
    const method = (request.method || 'GET').toUpperCase();
    const read = method === 'GET' || method === 'HEAD';
    const matched = ifNoneMatchMatches(
      (request.headers || {})['if-none-match'], etag);

    if (matched && read === false) {
      response.statusCode = 412;
      response.end();
      return;
    }

    // The headers a 200 carries, which a 304 carries too, as RFC 9110
    // section 15.4.5 requires.
    response.setHeader('Cache-Control', failed
      ? CACHE_CONTROL_AFTER_ERRORS
      : 'private, max-age=' + maxAgeSeconds);
    const vary = clientSideVary(flowData);
    if (vary) {
      response.setHeader('Vary', vary);
    }
    if (failed === false) {
      response.setHeader('ETag', etag);
    }

    if (matched) {
      response.statusCode = 304;
      response.end();
      return;
    }

    response.statusCode = 200;
    response.setHeader('Content-Type', contentType);
    response.setHeader('Content-Length', Buffer.byteLength(body));
    if (method === 'HEAD') {
      response.end();
    } else {
      response.end(body);
    }
  }
}

module.exports = Helpers;
