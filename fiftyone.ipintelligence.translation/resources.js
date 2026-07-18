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

const fs = require('fs');
const path = require('path');

/**
 * Resolve the default directory holding the translation YAML files. These
 * files arrive with the on-premise SDK through the ip-intelligence-cxx /
 * ip-intelligence-data submodule, which sits alongside this package.
 *
 * @returns {string} the default Translations directory path
 */
const defaultTranslationsDir = () =>
  path.join(__dirname, '..', 'fiftyone.ipintelligence.onpremise',
    'ip-intelligence-cxx', 'ip-intelligence-data', 'Translations');

/**
 * Read every YAML file in a directory whose name starts with the given
 * prefix, returning a map of file name to file content.
 *
 * @param {string} directory the directory to read
 * @param {string} prefix the file name prefix to match (e.g. 'countries')
 * @returns {object} a map of file name to YAML content string
 */
const readYamlFiles = (directory, prefix) => {
  const result = {};
  let files;
  try {
    files = fs.readdirSync(directory);
  } catch (e) {
    throw 'The translations directory \'' + directory + '\' could not be ' +
      'read. Ensure the ip-intelligence-cxx/ip-intelligence-data submodule ' +
      'has been initialised, or supply a translationsPath option. ' + e;
  }
  files.forEach((file) => {
    const lower = file.toLowerCase();
    if (lower.startsWith(prefix) &&
      (lower.endsWith('.yml') || lower.endsWith('.yaml'))) {
      result[file] = fs.readFileSync(path.join(directory, file), 'utf8');
    }
  });
  return result;
};

/**
 * Get the country code translation YAML files (countrycodes.*.yml), which map
 * an ISO country code to its English name.
 *
 * @param {string} [translationsPath] the Translations directory; defaults to
 * the submodule path returned by {@link defaultTranslationsDir}
 * @returns {object} a map of file name to YAML content string
 */
const getCountryCodeResources = (translationsPath) =>
  readYamlFiles(translationsPath || defaultTranslationsDir(), 'countrycodes');

/**
 * Get the country name translation YAML files (OSM/countries.*.yml), which map
 * an English country name to its localized name.
 *
 * @param {string} [translationsPath] the Translations directory; defaults to
 * the submodule path returned by {@link defaultTranslationsDir}
 * @returns {object} a map of file name to YAML content string
 */
const getCountryResources = (translationsPath) =>
  readYamlFiles(
    path.join(translationsPath || defaultTranslationsDir(), 'OSM'),
    'countries');

module.exports = {
  defaultTranslationsDir,
  getCountryCodeResources,
  getCountryResources
};
