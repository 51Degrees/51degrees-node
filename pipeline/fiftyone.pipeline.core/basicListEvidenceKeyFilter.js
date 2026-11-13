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

const EvidenceKeyFilter = require('./evidenceKeyFilter');

/**
 * An instance of evidenceKeyFilter that uses a simple array of keys
 * Evidence not using these keys is filtered out
 */
class BasicListEvidenceKeyFilter extends EvidenceKeyFilter {
  // The keys in lower case, and a copy of the list they were made from.
  // Every detection checks its evidence here at least twice, so the list is
  // put in lower case once, and again only when it changes.
  #folded = new Set();
  #foldedFrom = [];

  /**
   * constructor for basicListEvidenceKeyFilter
   *
   * @param {Array} list items to keep when filtering
   */
  constructor (list) {
    super();

    this.list = list;
  }

  /**
   * Check if a specific evidence key should be filtered
   *
   * @param {string} key to check in the filter
   * @returns {boolean} is this key in the filter's keys list?
   */
  filterEvidenceKey (key) {
    if (!this.#isFolded()) {
      const folded = new Set();
      this.list.forEach(function (element) {
        folded.add(element.toLowerCase());
      });
      this.#folded = folded;
      this.#foldedFrom = Array.from(this.list);
    }

    if (this.#folded.size === 0) {
      return undefined;
    }

    return this.#folded.has(key.toLowerCase()) ? true : undefined;
  }

  /**
   * Whether the keys in lower case were made from the list as it is now,
   * holding the same keys in the same order.
   *
   * @returns {boolean} true if the list has not changed since
   */
  #isFolded () {
    const list = this.list;
    const from = this.#foldedFrom;
    if (list.length !== from.length) {
      return false;
    }
    for (let i = 0; i < from.length; i++) {
      if (list[i] !== from[i]) {
        return false;
      }
    }
    return true;
  }
}

module.exports = BasicListEvidenceKeyFilter;
