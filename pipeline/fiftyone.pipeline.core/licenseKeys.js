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

// Mask for license keys in log entries and error messages. Only the last 4
// characters of a key are shown, and each character before them is replaced
// by one '*'. See
// https://github.com/51Degrees/specifications/blob/rc/pipeline-specification/features/logging.md#license-keys

const MaskCharacter = '*';
const VisibleCharacters = 4;

// A license key parameter in a URL or a message, such as license=,
// licenseKey=, licenseKeys= or licenceKeys=, up to the end of its value.
const KeyParameter = /((?:license|licence)(?:key)?s?=)([^&#\s'"]*)/gi;

// Punctuation that ends a sentence or a clause after a parameter's value.
// It is not part of the key.
const TrailingPunctuation = /[.,;:)!?]+$/;

// Keys are separated by a comma or a bar, as written or encoded.
const KeySeparator = /(%2C|%7C|,|\|)/i;

/**
 * Masks one key.
 *
 * @param {string} key the license key
 * @returns {string} the key with all but its last 4 characters replaced
 */
function maskKey (key) {
  if (key.length <= VisibleCharacters) {
    return MaskCharacter.repeat(key.length);
  }
  return MaskCharacter.repeat(key.length - VisibleCharacters) +
    key.slice(-VisibleCharacters);
}

/**
 * Masks each key in the value of a license key parameter.
 *
 * @param {string} value the value, which may hold several keys
 * @returns {string} the value with each key masked
 */
function maskValue (value) {
  return value.split(KeySeparator).map(
    (part, index) => index % 2 === 1 ? part : maskKey(part)).join('');
}

/**
 * The known keys to mask by value, longest first so that a key that holds
 * another is masked whole. A value that holds several keys gives each key
 * in it.
 *
 * @param {string|string[]} [keys] the known license keys
 * @returns {string[]} the keys to look for
 */
function knownKeys (keys) {
  const list = Array.isArray(keys) ? keys : [keys];
  const result = new Set();
  for (const key of list) {
    if (typeof key === 'string') {
      key.split(KeySeparator).forEach((part, index) => {
        if (index % 2 === 0 && part.length > 0) {
          result.add(part);
        }
      });
    }
  }
  return Array.from(result).sort((a, b) => b.length - a.length);
}

/**
 * Masks the license keys in a piece of text. Each known key is masked
 * wherever it appears, as written or encoded for a URL, and the value of
 * every license key parameter is masked.
 *
 * @param {string} text text that may hold a license key
 * @param {string[]} keys the known keys, from knownKeys
 * @returns {string} the text with each key masked
 */
function maskText (text, keys) {
  let result = text;
  for (const key of keys) {
    const masked = maskKey(key);
    result = result.split(key).join(masked);
    const encoded = encodeURIComponent(key);
    if (encoded !== key) {
      const maskedEncoded = encodeURIComponent(masked);
      const lowerEscapes = encoded.replace(
        /%[0-9A-F]{2}/g, (escape) => escape.toLowerCase());
      result = result.split(encoded).join(maskedEncoded)
        .split(lowerEscapes).join(maskedEncoded);
    }
  }
  return result.replace(KeyParameter, function (match, name, value) {
    const end = value.match(TrailingPunctuation);
    const key = end ? value.slice(0, end.index) : value;
    return name + maskValue(key) + (end ? end[0] : '');
  });
}

/**
 * Whether a value's contents are masked, which is so for an error, an
 * array and a plain object.
 *
 * @param {*} value the value
 * @returns {boolean} true if the value's contents are masked
 */
function isContainer (value) {
  if (value instanceof Error || Array.isArray(value)) {
    return true;
  }
  if (value === null || typeof value !== 'object') {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

/**
 * The values an error, an array or a plain object holds. For an error these
 * are its message, its stack and every own property.
 *
 * @param {object} value an error, an array or a plain object
 * @returns {Array} the values it holds
 */
function children (value) {
  const result = [];
  if (value instanceof Error) {
    result.push(value.message, value.stack);
  }
  for (const name of Object.getOwnPropertyNames(value)) {
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if ('value' in descriptor) {
      result.push(descriptor.value);
    }
  }
  return result;
}

/**
 * Whether a value holds a license key anywhere.
 *
 * @param {*} value the value
 * @param {string[]} keys the known keys
 * @param {Set} seen the containers already looked at
 * @returns {boolean} true if masking would change the value
 */
function holdsKey (value, keys, seen) {
  if (typeof value === 'string') {
    return maskText(value, keys) !== value;
  }
  if (!isContainer(value) || seen.has(value)) {
    return false;
  }
  seen.add(value);
  return children(value).some((child) => holdsKey(child, keys, seen));
}

/**
 * A copy of a value with each license key in it masked.
 *
 * @param {*} value the value
 * @param {string[]} keys the known keys
 * @param {Map} copies the copy already made of each container
 * @returns {*} the masked copy
 */
function copy (value, keys, copies) {
  if (typeof value === 'string') {
    return maskText(value, keys);
  }
  if (!isContainer(value)) {
    return value;
  }
  if (copies.has(value)) {
    return copies.get(value);
  }
  if (Array.isArray(value)) {
    const masked = new Array(value.length);
    copies.set(value, masked);
    value.forEach((item, index) => {
      masked[index] = copy(item, keys, copies);
    });
    return masked;
  }
  const masked = Object.create(Object.getPrototypeOf(value));
  copies.set(value, masked);
  const isError = value instanceof Error;
  for (const name of Object.getOwnPropertyNames(value)) {
    if (isError && (name === 'message' || name === 'stack')) {
      continue;
    }
    const descriptor = Object.getOwnPropertyDescriptor(value, name);
    if ('value' in descriptor) {
      descriptor.value = copy(descriptor.value, keys, copies);
    }
    Object.defineProperty(masked, name, descriptor);
  }
  if (isError) {
    // The message and stack can be inherited or accessors, so each is read
    // from the error and set on the copy as a plain property.
    for (const name of ['message', 'stack']) {
      const text = value[name];
      Object.defineProperty(masked, name, {
        value: typeof text === 'string' ? maskText(text, keys) : text,
        writable: true,
        configurable: true
      });
    }
  }
  return masked;
}

/**
 * Masks the license keys in a log message or an error. Text is masked, and
 * so is all the text an error, an array or a plain object holds, including
 * an error's message, stack and other properties. A value that holds no key
 * is returned as it is. Anything else is returned unchanged. The value of
 * every license key parameter is masked, and each known key is masked
 * wherever it appears.
 *
 * @param {*} value a log message or error
 * @param {string|string[]} [keys] license keys to mask wherever they
 * appear. A value that holds several, separated by a comma or a bar, is
 * masked as each of them. A key of 4 characters or fewer is replaced
 * wherever those characters appear, even inside other words.
 * @returns {*} a copy of the value with each license key masked, or the
 * value itself when it holds no key
 */
function mask (value, keys) {
  const known = knownKeys(keys);
  if (!holdsKey(value, known, new Set())) {
    return value;
  }
  return copy(value, known, new Map());
}

module.exports = { mask };
