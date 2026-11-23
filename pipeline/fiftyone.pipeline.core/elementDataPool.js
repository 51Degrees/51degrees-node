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

/**
 * @typedef {import('./elementData')} ElementData
 */

/**
 * A bounded pool of Element Data, so a Flow Element reuses instances rather
 * than making one for every request. An instance goes back to its pool when
 * the Flow Data that holds it is disposed and its processing has finished,
 * unless a cache holds it, as the cache shares it with other requests.
 * Keeping a reference to Element Data after its Flow Data is disposed is not
 * supported, because the pool may give the instance to another request.
 * Nothing checks for that when the Element Data is read.
 */
class ElementDataPool {
  /**
   * Constructor for ElementDataPool
   *
   * @param {object} [options] options for the pool
   * @param {number} [options.size] the most instances the pool keeps
   */
  constructor ({ size = 100 } = {}) {
    this.maxSize = size;
    this.free = [];

    /**
     * The number of instances made because the pool had none to give.
     *
     * @type {number}
     */
    this.created = 0;
  }

  /**
   * The number of instances the pool holds now.
   *
   * @returns {number} the number of instances held
   */
  get size () {
    return this.free.length;
  }

  /**
   * An instance from the pool with no values and open for writing, or a
   * new one from create when the pool is empty.
   *
   * @param {function(): ElementData} create makes a new instance
   * @returns {ElementData} the instance
   */
  take (create) {
    let data = this.free.pop();
    if (data === undefined) {
      data = create();
      this.created += 1;
    } else {
      data.reset();
    }
    data._pooling.pool = this;
    data._pooling.shared = false;
    return data;
  }

  /**
   * Keeps an instance for a later take, unless the pool is full.
   *
   * @param {ElementData} data the instance
   */
  give (data) {
    if (this.free.length < this.maxSize) {
      this.free.push(data);
    }
  }

  /**
   * Marks an instance as shared with other requests, such as one a cache
   * holds, so it never goes back to a pool.
   *
   * @param {ElementData} data the instance
   */
  static share (data) {
    if (data !== null && typeof data === 'object' &&
      data._pooling !== undefined) {
      data._pooling.shared = true;
    }
  }

  /**
   * Gives an instance back to the pool it came from, unless it came from
   * none or is shared with other requests.
   *
   * @param {ElementData} data the instance
   */
  static release (data) {
    if (data === null || typeof data !== 'object' ||
      data._pooling === undefined) {
      return;
    }
    const { pool, shared } = data._pooling;
    if (pool !== null && !shared) {
      data._pooling.pool = null;
      pool.give(data);
    }
  }
}

module.exports = ElementDataPool;
