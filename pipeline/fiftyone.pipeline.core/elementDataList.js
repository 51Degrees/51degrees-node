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
 * A node of the list in which a Flow Data keeps its Element Data, the
 * newest first.
 *
 * @typedef {object} ElementDataNode
 * @property {string} key the data key
 * @property {*} data the Element Data
 * @property {object|undefined} state the state the Element Data keeps of
 * whether it is finished, or undefined if the data is not Element Data
 * @property {ElementDataNode|null} next the node added before this one
 */

/**
 * The node holding the Element Data under a data key, or undefined if
 * there is none. Data added later under the same key replaces the earlier,
 * and a key that finds nothing as given is looked for again ignoring its
 * letter case. Ignoring case, the key added first that matches is used.
 *
 * @param {ElementDataNode|null} head the newest node of the list
 * @param {string} key the data key
 * @returns {ElementDataNode|undefined} the node
 */
function findNode (head, key) {
  for (let node = head; node !== null; node = node.next) {
    if (node.key === key) {
      return node;
    }
  }
  if (typeof key !== 'string') {
    return undefined;
  }
  // The list holds the newest first, so the last match is the key added
  // first, and its newest data is then found by that key.
  const lower = key.toLowerCase();
  let first;
  for (let node = head; node !== null; node = node.next) {
    if (typeof node.key === 'string' && node.key.toLowerCase() === lower) {
      first = node.key;
    }
  }
  if (first === undefined) {
    return undefined;
  }
  for (let node = head; node !== null; node = node.next) {
    if (node.key === first) {
      return node;
    }
  }
  return undefined;
}

module.exports = { findNode };
