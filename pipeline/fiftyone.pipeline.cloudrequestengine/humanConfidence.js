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

// What the Cloud Request Engine and the cloud engines share to redeem a
// sealed Human Confidence result, as human-confidence.md sets out in "When
// HumanConfidence arrives sealed" and "Redeeming through the JSON call".

const crypto = require('crypto');

/**
 * @typedef {import('fiftyone.pipeline.core').Evidence} Evidence
 */

// The Evidence that carries the sealed result.
const sealedEvidence = 'query.humanconfidence';

// The Evidence that names the page a sealed result came from. Its value is
// the page given by CloudRequestEngine.newHumanConfidencePage.
const pageEvidence = 'query.humanconfidencepage';

// The data key and the Property names the Values are given under.
const derivedKey = 'derived';
const valueProperty = 'humanconfidence';
const sourceProperty = 'humanconfidencesource';

// The Property the call names so the response holds the Value.
const requestedProperty = 'derived.HumanConfidence';

// The Values a sealed result redeems to.
const values = ['High', 'Medium', 'Low'];

// The Value and source for a sealed result that was not redeemed.
const notRedeemedValue = 'Medium';
const activeSource = 'Active';

// What a sealed result, a transaction or a License Key is replaced with in
// a log entry or an error message. No part of any of them is kept.
const hidden = '[hidden]';

// How long a page's transaction is kept, and how many are kept at most.
const defaultLifetimeMs = 10 * 60 * 1000;
const defaultLimit = 10000;

/**
 * The value of an Evidence key, looked for in any letter case, whether an
 * element in the Pipeline accepts the key or not.
 *
 * @param {Evidence} evidence the Flow Data's evidence
 * @param {string} key the key wanted, in lower case
 * @returns {*} the value, or undefined
 */
function evidenceValue (evidence, key) {
  // An older fiftyone.pipeline.core throws unaccepted evidence away.
  const unaccepted = typeof evidence.getUnaccepted === 'function'
    ? evidence.getUnaccepted()
    : {};
  for (const store of [evidence.getAll(), unaccepted]) {
    for (const name of Object.keys(store)) {
      if (name.toLowerCase() === key) {
        return store[name];
      }
    }
  }
  return undefined;
}

/**
 * The sealed result a request carries, being the value of
 * query.humanconfidence where it is not empty.
 *
 * @param {Evidence} evidence the Flow Data's evidence
 * @returns {string|undefined} the sealed result, or undefined for none
 */
function sealedResult (evidence) {
  const value = evidenceValue(evidence, sealedEvidence);
  if (value === undefined || value === null) {
    return undefined;
  }
  const text = String(value);
  return text === '' ? undefined : text;
}

/**
 * The page a request names, from query.humanconfidencepage.
 *
 * @param {Evidence} evidence the Flow Data's evidence
 * @returns {string|undefined} the page, or undefined for none
 */
function pageOf (evidence) {
  const value = evidenceValue(evidence, pageEvidence);
  return value === undefined || value === null || value === ''
    ? undefined
    : String(value);
}

/**
 * The transactions given to pages and not yet used. Each page gets a new
 * random transaction, kept here on the server, and a request redeeming a
 * sealed result takes the transaction of the page it names, which removes
 * it, so a transaction is used once. A transaction is kept for a limited
 * time, and the oldest is dropped once the limit is reached.
 */
class Transactions {
  /**
   * Makes an empty set of transactions.
   *
   * @param {object} [options] options
   * @param {number} [options.lifetimeMs] how long a transaction is kept
   * @param {number} [options.limit] how many transactions are kept at most
   */
  constructor ({ lifetimeMs = defaultLifetimeMs, limit = defaultLimit } = {}) {
    this.lifetimeMs = lifetimeMs;
    this.limit = limit;
    this.kept = new Map();
  }

  /**
   * Gives a new page and its new transaction, and keeps the transaction.
   *
   * @returns {{page: string, transaction: string}} the page and its
   * transaction
   */
  issue () {
    const now = Date.now();
    this.dropExpired(now);
    while (this.kept.size >= this.limit) {
      this.kept.delete(this.kept.keys().next().value);
    }
    const page = crypto.randomBytes(16).toString('base64url');
    const transaction = crypto.randomBytes(16).toString('base64url');
    this.kept.set(page, { transaction, expires: now + this.lifetimeMs });
    return { page, transaction };
  }

  /**
   * Takes the transaction kept for a page, so it cannot be taken again.
   *
   * @param {string|undefined} page the page
   * @returns {string|undefined} the transaction, or undefined where none is
   * kept for the page
   */
  take (page) {
    if (page === undefined) {
      return undefined;
    }
    const entry = this.kept.get(page);
    if (entry === undefined) {
      return undefined;
    }
    this.kept.delete(page);
    return entry.expires < Date.now() ? undefined : entry.transaction;
  }

  /**
   * Drops the transactions that have been kept too long. They were added
   * in time order, so the oldest come first.
   *
   * @param {number} now the time now
   */
  dropExpired (now) {
    for (const [page, entry] of this.kept) {
      if (entry.expires >= now) {
        return;
      }
      this.kept.delete(page);
    }
  }
}

/**
 * Replaces each secret in a text, as written and URL encoded with upper or
 * lower case escapes, so a log entry or an error message holds none of it.
 *
 * @param {string} text the text
 * @param {Array<string|undefined>} withheld the values to leave out
 * @returns {string} the text without them
 */
function hide (text, withheld) {
  let result = String(text);
  const forms = [];
  for (const secret of withheld) {
    if (typeof secret === 'string' && secret !== '') {
      const encoded = encodeURIComponent(secret);
      forms.push(secret, encoded, encoded.replace(
        /%[0-9A-F]{2}/g, (escape) => escape.toLowerCase()));
    }
  }
  // Longer forms first, so a secret inside another is not left in part.
  forms.sort((a, b) => b.length - a.length);
  for (const form of forms) {
    result = result.split(form).join(hidden);
  }
  return result;
}

/**
 * The Value in a response to a call that carried a sealed result, being the
 * derived member's humanconfidence where it is High, Medium or Low, and
 * Medium otherwise.
 *
 * @param {*} answer the response, parsed from JSON
 * @returns {string} the Value
 */
function valueIn (answer) {
  const derived = answer !== null && typeof answer === 'object'
    ? answer[derivedKey]
    : undefined;
  const value = derived !== null && typeof derived === 'object'
    ? derived[valueProperty]
    : undefined;
  return values.includes(value) ? value : notRedeemedValue;
}

/**
 * Sets the two Properties in a response to a call that carried a sealed
 * result. HumanConfidence is the Value where the sealed result was
 * redeemed, and Medium otherwise. HumanConfidenceSource is Active.
 *
 * @param {object} answer the response, parsed from JSON, which is changed
 * @param {boolean} redeemed whether the call carried the sealed result
 * with its transaction and License Key
 */
function setValues (answer, redeemed) {
  const existing = answer[derivedKey];
  const derived = existing !== null && typeof existing === 'object'
    ? existing
    : {};
  derived[valueProperty] = redeemed ? valueIn(answer) : notRedeemedValue;
  derived[sourceProperty] = activeSource;
  delete derived[valueProperty + 'nullreason'];
  delete derived[sourceProperty + 'nullreason'];
  answer[derivedKey] = derived;
}

module.exports = {
  sealedEvidence,
  pageEvidence,
  derivedKey,
  valueProperty,
  sourceProperty,
  requestedProperty,
  notRedeemedValue,
  activeSource,
  hidden,
  sealedResult,
  pageOf,
  Transactions,
  hide,
  setValues
};
