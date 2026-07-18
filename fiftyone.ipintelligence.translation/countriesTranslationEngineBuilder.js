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

const yaml = require('js-yaml');

const CountriesTranslationEngine = require('./countriesTranslationEngine');
const Resources = require('./resources');

/**
 * Builder for the {@link CountriesTranslationEngine}. It loads the
 * countries.*.yml resources (English name to localized name) used by the base
 * translation engine, and the countrycodes.en_GB.yml resource which lists all
 * known country codes and their English names in order. The latter is passed
 * to the engine so it can append the countries that IP intelligence did not
 * weight.
 */
class CountriesTranslationEngineBuilder {
  /**
   * Constructor.
   *
   * @param {object} [options] the options object
   * @param {string} [options.translationsPath] the directory holding the
   * translation YAML files; defaults to the ip-intelligence-data submodule
   * path
   */
  constructor ({ translationsPath } = {}) {
    this.translationsPath = translationsPath;
  }

  /**
   * Build a new {@link CountriesTranslationEngine}.
   *
   * @returns {CountriesTranslationEngine} the constructed engine
   */
  build () {
    const sources = Resources.getCountryResources(this.translationsPath);
    const codeResources =
      Resources.getCountryCodeResources(this.translationsPath);
    const allCountries =
      CountriesTranslationEngineBuilder.parseAllCountries(codeResources);
    return new CountriesTranslationEngine({ sources, allCountries });
  }

  /**
   * Parse the countrycodes.en_GB.yml resource into an ordered list of all
   * known countries as { code, englishName } pairs, preserving file order.
   *
   * @param {object} codeResources a map of file name to YAML content string
   * @returns {Array<object>} the ordered list of { code, englishName } pairs
   */
  static parseAllCountries (codeResources) {
    const content = Object.values(codeResources)[0];
    const map = content ? yaml.load(content) : {};
    return Object.keys(map).map((code) => ({
      code,
      englishName: map[code]
    }));
  }
}

module.exports = CountriesTranslationEngineBuilder;
