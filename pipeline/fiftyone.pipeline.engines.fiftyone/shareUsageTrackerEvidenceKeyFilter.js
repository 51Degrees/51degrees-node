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

const ShareUsageEvidenceKeyFilter = require('./shareUsageEvidenceKeyFilter');

/**
 * The evidence the ShareUsageTracker compares to decide whether a request
 * repeats one already shared. The session id and sequence number are left
 * out, because they make every request different.
 */
class ShareUsageTrackerEvidenceKeyFilter extends ShareUsageEvidenceKeyFilter {
  /**
   * Check if a specific key should be filtered
   *
   * @param {string} key evidence key to filter
   * @returns {boolean} whether to keep the evidence
   **/
  filterEvidenceKey (key) {
    const lowerKey = key.toLowerCase();
    if (lowerKey === 'query.session-id' || lowerKey === 'query.sequence') {
      return false;
    }
    return super.filterEvidenceKey(key);
  }
}

module.exports = ShareUsageTrackerEvidenceKeyFilter;
