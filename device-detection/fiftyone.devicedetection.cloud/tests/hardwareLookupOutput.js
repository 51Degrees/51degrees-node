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

// What the live tests of the TAC and native model lookup examples require of
// the output. An example says in one line that the resource key does not
// carry the hardware lookup, or prints a heading for each value it looks up
// with one tab-indented line per device under it.

// Part of the line printed when the key does not carry the hardware lookup.
const NO_HARDWARE_LOOKUP = 'does not include HardwarePlatform.Profiles';

// How the examples show a property with no value, which getValueHelper
// follows with the reason in parentheses.
const NO_VALUE = 'Unknown';

/**
 * The tab-indented lines that follow a heading, up to the next line that is
 * not indented.
 *
 * @param {string} text Everything the example printed
 * @param {string} heading The heading of one lookup
 * @returns {Array<string>} The lines, without the tab
 */
const linesUnder = function (text, heading) {
  const lines = text.split(/\r?\n/);
  const found = [];
  let at = lines.indexOf(heading);
  if (at < 0) {
    return found;
  }
  for (at++; at < lines.length && lines[at].startsWith('\t'); at++) {
    found.push(lines[at].slice(1));
  }
  return found;
};

/**
 * Whether a value is empty or is how the examples show a property with no
 * value.
 *
 * @param {string} value The text of the value
 * @returns {boolean} True when there is no value
 */
const isNoValue = function (value) {
  return value === '' || value === NO_VALUE ||
    value.startsWith(NO_VALUE + ' (');
};

/**
 * Whether a device line has the form '<vendor> <name> (<model>)' with a
 * vendor and a model. The vendor is the text before the first space and the
 * model the text inside the final parentheses, which hold parentheses of
 * their own when the model is shown with the reason it has no value.
 *
 * @param {string} line A device line, without its tab
 * @returns {boolean} True when the line names a vendor and a model
 */
const hasVendorAndModel = function (line) {
  if (!line.endsWith(')')) {
    return false;
  }
  let depth = 0;
  let open = -1;
  for (let i = line.length - 1; i >= 0 && open < 0; i--) {
    if (line[i] === ')') {
      depth++;
    } else if (line[i] === '(' && --depth === 0) {
      open = i;
    }
  }
  const space = line.indexOf(' ');
  if (open < 0 || space < 0 || line[open - 1] !== ' ' || space >= open - 1) {
    return false;
  }
  return !isNoValue(line.slice(0, space)) &&
    !isNoValue(line.slice(open + 1, -1));
};

/**
 * Throws, as the live test of a hardware lookup example must fail, when the
 * output says the resource key does not carry the lookup, or when a value's
 * heading has no device line with a vendor and a model under it. Each
 * message is followed by the output.
 *
 * @param {string} text Everything the example printed
 * @param {object} lookup The lookup the example makes
 * @param {string} lookup.keyName The variable the resource key came from
 * @param {string} lookup.name The lookup, such as 'TAC lookup'
 * @param {string} lookup.subject What a value is, such as 'TAC'
 * @param {Array<string>} lookup.values The values the example looks up
 */
const checkHardwareLookupOutput = function (text, lookup) {
  if (text.includes(NO_HARDWARE_LOOKUP)) {
    throw new Error(`The resource key in ${lookup.keyName} does not ` +
      'include HardwarePlatform.Profiles, which the ' +
      `${lookup.name} needs.\n${text}`);
  }
  for (const value of lookup.values) {
    const heading = 'Which devices are associated with the ' +
      `${lookup.subject} '${value}'?`;
    if (!linesUnder(text, heading).some(hasVendorAndModel)) {
      throw new Error('No device with a vendor and a model was listed for ' +
        `the ${lookup.subject} '${value}'.\n${text}`);
    }
  }
};

module.exports = {
  checkHardwareLookupOutput,
  hasVendorAndModel
};
