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

const core = require('fiftyone.pipeline.core');

const EvidenceKeyFilter = core.EvidenceKeyFilter;

// The key of the web request the web integration adds to the evidence.
const HTTP_REQUEST_KEY = core.Constants.evidenceHttpRequest;

// Cookies, session values and query string parameters whose names start with
// this are the ones 51Degrees sets, and are shared.
const FIFTYONE_PREFIX = '51d_';

// The Cookie header carries every cookie, including the ones the cookie rule
// leaves out, so it is not shared unless all evidence is.
const BLOCKED_HEADERS = ['cookie'];

// Evidence that is never shared, whatever the settings, matched as the whole
// key or after a '.'. 'id.email' and 'id.salt' are a raw email address and the
// salt used to make hashed email identifiers. 'request-query' is the whole
// query string, which would undo the rules for its parameters. 'request-path'
// would make each page a visitor opens look like a new session to the tracker.
const NEVER_SHARED_KEYS = ['id.email', 'id.salt', 'request-query', 'request-path'];

/**
 * The ShareUsageEvidenceKeyFilter decides which evidence the 51Degrees
 * ShareUsage service is sent. Headers are shared unless they are blocked,
 * cookies and session values only when their names start with 51D_, and
 * query string and form parameters only when their names start with 51D_ or
 * are on the list to share. Any other evidence is shared.
 */
class ShareUsageEvidenceKeyFilter extends EvidenceKeyFilter {
  /**
   * Constructor for ShareUsageEvidenceKeyFilter
   *
   * @param {object} options options for filter
   * @param {string} options.cookie the name of the cookie that identifies
   * the session
   * @param {Array<string>|null} options.queryWhitelist query string and
   * form parameters to share as well as those starting 51D_, or null to
   * share every parameter
   * @param {Array<string>} options.headerBlacklist headers not to share
   * @param {boolean} options.includeSession whether the session cookie is
   * included
   * @param {boolean} options.shareAll whether all evidence is shared, apart
   * from the evidence that is never shared
   */
  constructor ({
    cookie,
    queryWhitelist = [],
    headerBlacklist = [],
    includeSession = false,
    shareAll = false
  } = {}) {
    super(...arguments);

    this.includedQueryStringParams = queryWhitelist === null
      ? null
      : queryWhitelist.map(parameter => parameter.toLowerCase());
    this.blockedHttpHeaders = (headerBlacklist || [])
      .map(header => header.toLowerCase());
    this.cookie = cookie ? cookie.toLowerCase() : undefined;
    this.includeSession = includeSession;
    this.shareAll = shareAll;
  }

  /**
   * Check if a specific key should be filtered
   *
   * @param {string} key evidence key to filter
   * @returns {boolean} whether to keep the evidence
   **/
  filterEvidenceKey (key) {
    const lowerKey = key.toLowerCase();

    if (NEVER_SHARED_KEYS.some(neverShared =>
      lowerKey === neverShared || lowerKey.endsWith('.' + neverShared))) {
      return false;
    }

    // The web request is read for its values and never shared itself.
    if (lowerKey === HTTP_REQUEST_KEY) {
      return false;
    }

    if (this.shareAll) {
      return true;
    }

    // The prefix is everything before the first dot and the field
    // everything after it, so a field can itself contain dots.
    const separator = lowerKey.indexOf('.');
    if (separator < 0) {
      return true;
    }
    const prefix = lowerKey.substring(0, separator);
    const field = lowerKey.substring(separator + 1);

    if (prefix === 'header') {
      // Add the header to the list if the header name does not
      // appear in the list of blocked headers.
      return this.blockedHttpHeaders.includes(field) === false &&
        BLOCKED_HEADERS.includes(field) === false;
    }
    if (prefix === 'cookie') {
      // Only add cookies that start with the 51Degrees cookie
      // prefix.
      return field.startsWith(FIFTYONE_PREFIX) ||
        (this.includeSession && field === this.cookie);
    }
    if (prefix === 'session') {
      // Only add session values that start with the 51Degrees
      // cookie prefix.
      return field.startsWith(FIFTYONE_PREFIX);
    }
    if (prefix === 'query') {
      // If no query string parameter list was given then share all of
      // them. Otherwise, only include query string parameters that
      // start with 51d_ or that are in the list.
      return this.includedQueryStringParams === null ||
        field.startsWith(FIFTYONE_PREFIX) ||
        this.includedQueryStringParams.includes(field);
    }
    // Add anything that is not a cookie, header, session
    // variable or query string parameter.
    return true;
  }
}

module.exports = ShareUsageEvidenceKeyFilter;
