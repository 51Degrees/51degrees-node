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

// This module is internal to the package.

// Any character with the Unicode White_Space property. `trim()` and `\s`
// are not used, because both also take U+FEFF, which is not white space,
// and `trim()` leaves U+0085, which is.
const WHITE_SPACE = /\p{White_Space}/u;

// The characters for the values 62 and 63 that only one alphabet uses.
const STANDARD_ONLY = /[+/]/;
const URL_SAFE_ONLY = /[-_]/;

/**
 * The text without the white space before and after it. A loop, because a
 * regular expression anchored at the end takes time growing with the
 * square of the length of any run of white space inside the text.
 * @param {string} value the text
 * @returns {string} the text without white space at either end
 */
function trimWhiteSpace (value) {
  let start = 0;
  let end = value.length;
  while (start < end && WHITE_SPACE.test(value[start])) {
    start++;
  }
  while (end > start && WHITE_SPACE.test(value[end - 1])) {
    end--;
  }
  return value.slice(start, end);
}

/**
 * The standard alphabet, padded form of base 64 written in either
 * alphabet. A 51Did is issued in the standard alphabet with padding, and a
 * page that puts one in a link uses the URL safe alphabet without it.
 * Every reader of a 51Did normalises through here.
 *
 * White space before and after the text is ignored. White space inside the
 * text, and a text holding a character from each alphabet such as both `+`
 * and `-`, give null, as the 51Did specification requires, because the
 * issuer writes neither and either is a sign of a damaged value.
 *
 * Written by hand because the package runs in a browser as well as in
 * Node. A browser has no `Buffer`, which reads both alphabets, and its
 * `atob` refuses the URL safe one. `Uint8Array.fromBase64` is in newer
 * browsers and not in Node 24. `atob` needs no padding, which is added
 * because `FodId.toStandardBase64` answers with the form the cloud issues.
 * @param {string} value base 64 in either alphabet, with or without padding
 * @returns {string|null} the standard alphabet form, padded, or null where
 * the text is refused
 */
function toStandardBase64 (value) {
  // Trimmed before anything else, because the padding below is decided by
  // the length.
  const text = trimWhiteSpace(value);
  // `atob` would skip some white space inside the text, being the space,
  // tab, line feed, form feed and carriage return.
  if (WHITE_SPACE.test(text)) {
    return null;
  }
  // Checked before the mapping below, which would hide a mix.
  if (STANDARD_ONLY.test(text) && URL_SAFE_ONLY.test(text)) {
    return null;
  }
  let base64 = text.replace(/-/g, '+').replace(/_/g, '/');
  switch (base64.length % 4) {
    case 2: base64 += '=='; break;
    case 3: base64 += '='; break;
  }
  return base64;
}

module.exports = { toStandardBase64, trimWhiteSpace };
