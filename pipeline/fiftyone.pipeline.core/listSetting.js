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
 * Reads a setting that holds a list of strings. Code gives the list itself,
 * and a configuration file gives one comma separated string, as
 * https://github.com/51Degrees/specifications/blob/main/pipeline-specification/features/pipeline-configuration.md
 * says for every language.
 *
 * A string with no items is taken as not set, because an empty list
 * restricts an engine to no properties.
 *
 * @param {Array<string>|string|null|undefined} value the setting
 * @returns {Array<string>|null|undefined} the list given, or the items of
 * the string, each without the space around it and leaving out empty ones,
 * or the value itself when it is not set
 */
function listSetting (value) {
  if (typeof value !== 'string') {
    return value;
  }
  const items = value
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item !== '');
  return items.length > 0 ? items : undefined;
}

module.exports = listSetting;
