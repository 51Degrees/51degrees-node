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

const translation = require('fiftyone.pipeline.translation');
const TranslationEngine = translation.TranslationEngine;
const MissingTranslationBehavior = translation.MissingTranslationBehavior;

const constants = require('./constants');

/**
 * Engine which takes the weighted country code lists from the IP intelligence
 * engine and translates them to country names. The country names are always
 * in English, so the engine uses the fixed 'en_GB' language.
 *
 * Results are stored under the {@link constants.countryNamesKey} key as the
 * weighted lists CountryNamesGeographical and CountryNamesPopulation, with the
 * original weights preserved.
 */
class CountryCodeTranslationEngine extends TranslationEngine {
  /**
   * Constructor.
   *
   * @param {object} options the options object
   * @param {object} options.sources the countrycodes.*.yml translation
   * sources, a map of file name to YAML content string
   */
  constructor ({ sources } = {}) {
    // The older option names, sourceDataKey and behavior, are passed because
    // every release of fiftyone.pipeline.translation accepts them.
    super({
      sourceDataKey: constants.ipDataKey,
      elementDataKey: constants.countryNamesKey,
      translations: [
        {
          source: 'countrycodesgeographical',
          destination: 'countrynamesgeographical'
        },
        {
          source: 'countrycodespopulation',
          destination: 'countrynamespopulation'
        }
      ],
      sources,
      fixedLanguage: 'en_GB',
      behavior: MissingTranslationBehavior.Original
    });
  }
}

module.exports = CountryCodeTranslationEngine;
