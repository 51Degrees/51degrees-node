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
// characters of a key are shown and every character before them is replaced.

const MaskCharacter = '*';
const VisibleCharacters = 4;

// A license key parameter in a URL or a message, such as license=,
// licenseKey=, licenseKeys= or licenceKeys=, up to the end of its value.
const KeyParameter = /((?:license|licence)(?:key)?s?=)([^&#\s'"]*)/gi;

// Keys are separated by a comma, as written or encoded, or by a bar.
const KeySeparator = /(%2C|,|\|)/i;

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
 * Masks the license keys in a piece of text.
 *
 * @param {string} text text that may hold a license key parameter
 * @returns {string} the text with each key masked
 */
function maskText (text) {
  return text.replace(KeyParameter, function (match, name, value) {
    return name + value.split(KeySeparator).map(
      (part, index) => index % 2 === 1 ? part : maskKey(part)).join('');
  });
}

/**
 * Masks the license keys in a log message or an error. Text and the message
 * of an error are masked. An error that holds no key is returned as it is,
 * and anything else is returned unchanged.
 *
 * @param {*} value a log message or error
 * @returns {*} the value with each license key masked
 */
function mask (value) {
  if (typeof value === 'string') {
    return maskText(value);
  }
  if (value instanceof Error) {
    const message = maskText(value.message);
    const stack = typeof value.stack === 'string'
      ? maskText(value.stack)
      : value.stack;
    if (message === value.message && stack === value.stack) {
      return value;
    }
    const masked = Object.assign(Object.create(Object.getPrototypeOf(value)),
      value);
    Object.defineProperty(masked, 'message', {
      value: message, writable: true, configurable: true
    });
    Object.defineProperty(masked, 'stack', {
      value: stack, writable: true, configurable: true
    });
    return masked;
  }
  return value;
}

module.exports = { mask };
