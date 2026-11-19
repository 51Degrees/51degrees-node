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

// Evidence that is never shared, whatever the settings, matched as the whole
// key or after a '.'. 'id.email' and 'id.salt' are a raw email address and the
// salt used to make hashed email identifiers. 'request-query' is the whole
// query string, which would undo the rules for its parameters. 'request-path'
// would make each page a visitor opens look like a new session to the tracker.
// 'header.cookie' is the Cookie header, which carries every cookie, and the
// cookies that are shared are shared as their own 'cookie.' evidence.
const NEVER_SHARED_KEYS = [
  'id.email', 'id.salt', 'request-query', 'request-path', 'header.cookie'
];

/**
 * The ShareUsageEvidenceKeyFilter decides which evidence the 51Degrees
 * ShareUsage service is sent. Headers are shared unless they are blocked,
 * cookies only when their names start with 51D_, whatever the settings,
 * session values only when their names start with 51D_, and every query
 * string and form parameter unless sharing them all is turned off, when only
 * those whose names start with 51D_ or are on the list to share are. Any
 * other evidence is shared.
 */
class ShareUsageEvidenceKeyFilter extends EvidenceKeyFilter {
  /**
   * Constructor for ShareUsageEvidenceKeyFilter
   *
   * @param {object} options options for filter
   * @param {string} options.cookie the name of the cookie that identifies
   * the session
   * @param {boolean} options.shareAllQueryStringParameters deprecated, and
   * has no effect
   * @param {Array<string>|null} options.queryWhitelist deprecated, and has
   * no effect
   * @param {Array<string>} [options.keptQueryParameters] query string
   * parameters kept for the usage sharing element's own use, being the
   * session id and sequence it reads, which are not otherwise shared
   * @param {Array<string>} options.headerBlacklist headers not to share
   * @param {boolean} options.includeSession whether the session cookie is
   * included
   * @param {boolean} options.shareAll whether all evidence is shared, apart
   * from the evidence that is never shared and the cookies whose names do
   * not start with 51D_
   */
  constructor ({
    cookie,
    shareAllQueryStringParameters,
    queryWhitelist,
    keptQueryParameters = [],
    headerBlacklist = [],
    includeSession = false,
    shareAll = false
  } = {}) {
    super(...arguments);

    this.keptQueryParameters = (keptQueryParameters || [])
      .map(parameter => parameter.toLowerCase());
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

    // The prefix is everything before the first dot and the field
    // everything after it, so a field can itself contain dots.
    const separator = lowerKey.indexOf('.');
    const prefix = separator < 0 ? '' : lowerKey.substring(0, separator);
    const field = lowerKey.substring(separator + 1);

    if (prefix === 'cookie') {
      // Only cookies that start with the 51Degrees cookie prefix are
      // shared, even when all evidence is, and the session cookie only
      // where it is asked for.
      return field.startsWith(FIFTYONE_PREFIX) ||
        (this.includeSession && field === this.cookie);
    }

    if (prefix === 'query') {
      // A query string or form parameter is shared when its name starts
      // with 51D_, whatever the settings. One a Flow Element of the
      // Pipeline accepts is shared too, which the usage sharing element
      // decides, as only it knows the Pipeline.
      return field.startsWith(FIFTYONE_PREFIX) ||
        this.keptQueryParameters.includes(field);
    }

    if (this.shareAll || separator < 0) {
      return true;
    }

    if (prefix === 'header') {
      // Add the header to the list if the header name does not
      // appear in the list of blocked headers.
      return this.blockedHttpHeaders.includes(field) === false;
    }
    if (prefix === 'session') {
      // Only add session values that start with the 51Degrees
      // cookie prefix.
      return field.startsWith(FIFTYONE_PREFIX);
    }
    // Add anything that is not a cookie, header, session
    // variable or query string parameter.
    return true;
  }
}

/**
 * Whether a key is a query string or form parameter that may be shared when
 * a Flow Element of the Pipeline accepts it, being any 'query.' key that is
 * not one that is never shared.
 *
 * @param {string} key evidence key
 * @returns {boolean} true for such a key
 */
ShareUsageEvidenceKeyFilter.isParameter = (key) => {
  const lowerKey = String(key).toLowerCase();
  return lowerKey.startsWith('query.') &&
    !NEVER_SHARED_KEYS.some(neverShared =>
      lowerKey === neverShared || lowerKey.endsWith('.' + neverShared));
};

module.exports = ShareUsageEvidenceKeyFilter;
