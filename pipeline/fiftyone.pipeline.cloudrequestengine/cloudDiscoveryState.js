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
 * Reads the JSON of a discovery copy, refusing text that is not JSON with
 * the refusal given rather than with a bare parse failure.
 *
 * @param {string} text the JSON
 * @param {string} refusal what to say when the text is not JSON
 * @returns {object} the JSON parsed
 * @throws {TypeError} when the text is not JSON
 */
function readJson (text, refusal) {
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new TypeError(refusal);
  }
}

/**
 * A copy of what the Cloud Request Engine's discovery fetched, being the
 * evidence keys the cloud service accepts and its answer listing the
 * accessible properties, which depend only on the keys in use. An engine
 * given a copy makes no discovery request. The JSON is the form the Java
 * package's CloudDiscoveryState writes.
 */
class CloudDiscoveryState {
  /**
   * Constructor for CloudDiscoveryState
   *
   * @param {Array<string>} evidenceKeys the evidence keys the cloud service
   * accepts, as its evidencekeys answer lists them
   * @param {string|object} accessibleProperties the cloud service's
   * accessibleproperties answer, as JSON text or parsed
   * @throws {TypeError} when the evidence keys are not a list, the answer is
   * not JSON, or it has no Products member
   */
  constructor (evidenceKeys, accessibleProperties) {
    if (!Array.isArray(evidenceKeys)) {
      throw new TypeError('A discovery copy needs the list of evidence keys ' +
        'the cloud service accepts.');
    }
    const answer = typeof accessibleProperties === 'string'
      ? readJson(accessibleProperties, "A discovery copy's accessible " +
        "properties answer is not JSON. An engine's discoveryState takes " +
        'the JSON toJson writes, or that JSON parsed.')
      : accessibleProperties;
    if (answer === null || typeof answer !== 'object' ||
      answer.Products === null || typeof answer.Products !== 'object') {
      throw new TypeError("A discovery copy needs the cloud service's " +
        'accessible properties answer, with its Products member.');
    }
    /**
     * The evidence keys the cloud service accepts.
     *
     * @type {ReadonlyArray<string>}
     */
    this.evidenceKeys = Object.freeze(evidenceKeys.map(String));
    /**
     * The accessible properties answer, as JSON text.
     *
     * @type {string}
     */
    this.accessibleProperties = JSON.stringify(answer);
    Object.freeze(this);
  }

  /**
   * The copy as JSON text, to keep and give to a later engine.
   *
   * @returns {string} an object with evidenceKeys and accessibleProperties
   */
  toJson () {
    return JSON.stringify({
      evidenceKeys: this.evidenceKeys,
      accessibleProperties: JSON.parse(this.accessibleProperties)
    });
  }

  /**
   * Reads a copy from the JSON toJson writes, as text or parsed.
   *
   * @param {string|object} json the copy's JSON
   * @returns {CloudDiscoveryState} the copy
   * @throws {TypeError} when the text is not JSON, or either part is missing
   */
  static fromJson (json) {
    const document = typeof json === 'string'
      ? readJson(json, "A discovery copy is not JSON. An engine's " +
        'discoveryState takes the JSON toJson writes, or that JSON parsed.')
      : json;
    if (document === null || typeof document !== 'object') {
      throw new TypeError('A discovery copy is an object with evidenceKeys ' +
        'and accessibleProperties.');
    }
    return new CloudDiscoveryState(
      document.evidenceKeys, document.accessibleProperties);
  }
}

module.exports = CloudDiscoveryState;
