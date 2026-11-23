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
const AspectPropertyValue =
  require('fiftyone.pipeline.core').AspectPropertyValue;

const constants = require('./constants');

// The evidence keys, in precedence order, used to resolve the language for
// the "All" list translation and sorting.
const evidenceKeys = [
  'query.translation',
  'query.accept-language',
  'header.accept-language'
];

/**
 * Create a comparer (a (a, b) => number function) for sorting translated
 * country names. When a culture is supplied a locale-aware, case-sensitive
 * comparison is used; otherwise a case-insensitive invariant comparison is
 * used (matching the English / unresolved-locale path).
 *
 * @param {string} cultureUsed the culture e.g. 'fr-FR', or an empty string
 * @returns {Function} a comparison function
 */
const createComparer = (cultureUsed) => {
  if (!cultureUsed) {
    const collator = new Intl.Collator('en', { sensitivity: 'accent' });
    return (a, b) => collator.compare(a, b);
  }
  const collator = new Intl.Collator(cultureUsed, { sensitivity: 'variant' });
  return (a, b) => collator.compare(a, b);
};

/**
 * Read a weighted list value from element data, returning the array of
 * weighted values or an empty array when the property is absent or has no
 * value.
 *
 * @param {object} data the element data to read from
 * @param {string} key the property key
 * @returns {Array} the weighted value array, or an empty array
 */
const readWeightedList = (data, key) => {
  let value;
  try {
    value = data.get(key);
  } catch (e) {
    return [];
  }
  if (value && value.hasValue) {
    return value.value;
  }
  return [];
};

/**
 * Build the weighted (country code, translated name) tuples for one
 * dimension, ordered by weight descending then by translated name ascending.
 *
 * @param {Array} translatedNames the weighted translated names
 * @param {Array} codes the weighted country codes (index-aligned with names)
 * @param {Function} comparer the name comparer for the tie-break
 * @returns {Array<object>} ordered tuples of { code, name }
 */
const buildWeightedTuples = (translatedNames, codes, comparer) => {
  if (!translatedNames || !codes) {
    return [];
  }
  const count = Math.min(translatedNames.length, codes.length);
  const tuples = [];
  for (let i = 0; i < count; i++) {
    tuples.push({
      code: codes[i].value,
      name: translatedNames[i].value,
      rawWeight: translatedNames[i].rawWeight
    });
  }
  tuples.sort((a, b) => b.rawWeight - a.rawWeight || comparer(a.name, b.name));
  return tuples.map((tuple) => ({ code: tuple.code, name: tuple.name }));
};

/**
 * Engine which takes the English country name properties produced by the
 * {@link CountryCodeTranslationEngine} and the weighted country code lists
 * from the IP intelligence engine, translates the country names to the browser
 * language, and produces complete ordered lists of all countries (the weighted
 * countries first, then every remaining country alphabetically).
 *
 * The base class produces the weighted translated names. This subclass adds
 * the "All" list construction. Results are stored under the
 * {@link constants.countryNamesTranslatedKey} key.
 */
class CountriesTranslationEngine extends TranslationEngine {
  /**
   * Constructor.
   *
   * @param {object} options the options object
   * @param {object} options.sources the countries.*.yml translation sources, a
   * map of file name to YAML content string
   * @param {Array<object>} options.allCountries the ordered list of all known
   * countries as { code, englishName } pairs, from countrycodes.en_GB.yml
   */
  constructor ({ sources, allCountries } = {}) {
    super({
      sourceDataKey: constants.countryNamesKey,
      elementDataKey: constants.countryNamesTranslatedKey,
      translations: [
        {
          source: 'countrynamesgeographical',
          destination: 'countrynamesgeographicaltranslated'
        },
        {
          source: 'countrynamespopulation',
          destination: 'countrynamespopulationtranslated'
        }
      ],
      sources,
      fixedLanguage: null,
      behavior: MissingTranslationBehavior.Original
    });

    this.allCountries = allCountries || [];
    // The set of real country codes, used to drop the IP engine's no-match
    // sentinel (e.g. 'Unknown') from the "All" lists.
    this.validCodes = new Set(
      this.allCountries.map((country) => country.code.toLowerCase()));

    // Advertise the additional output properties on top of the two weighted
    // translations declared by the base class.
    Object.assign(this.properties, {
      countrynamesgeographicalalltranslated: { type: 'string[]' },
      countrynamespopulationalltranslated: { type: 'string[]' },
      countrycodesgeographicalall: { type: 'string[]' },
      countrycodespopulationall: { type: 'string[]' },
      sortingcultureused: { type: 'string' }
    });
  }

  /**
   * Produce the weighted translated names (via the base class) and the
   * complete ordered "All" lists for both the geographical and population
   * dimensions.
   *
   * @param {object} flowData the flow data being processed
   */
  processInternal (flowData) {
    // Let the base class produce the weighted translations. It recognises
    // English as the base language and uses a pass-through translator when
    // appropriate.
    super.processInternal(flowData);

    const data = flowData.get(this.dataKey);

    // Resolve the translator and a locale-aware comparer for the "All" lists.
    const resolved = this.resolveTranslator(flowData);
    let translator = null;
    let cultureUsed = '';
    if (resolved !== null) {
      translator = resolved.translator;
      cultureUsed = resolved.matchedLocale.replace(/_/g, '-');
    }
    const comparer = createComparer(cultureUsed);
    data.contents.sortingcultureused = cultureUsed;

    // Read the weighted codes directly from the IP intelligence element data.
    let geoCodes = [];
    let popCodes = [];
    try {
      const ipData = flowData.get(constants.ipDataKey);
      geoCodes = readWeightedList(ipData, 'countrycodesgeographical');
      popCodes = readWeightedList(ipData, 'countrycodespopulation');
    } catch (e) {
      // No IP intelligence data available.
    }

    // Read the weighted translated names produced by the base class.
    const geoNames =
      readWeightedList(data, 'countrynamesgeographicaltranslated');
    const popNames =
      readWeightedList(data, 'countrynamespopulationtranslated');

    this.buildAndStoreAllLists(data, geoNames, geoCodes, translator, comparer,
      'countrynamesgeographicalalltranslated', 'countrycodesgeographicalall');
    this.buildAndStoreAllLists(data, popNames, popCodes, translator, comparer,
      'countrynamespopulationalltranslated', 'countrycodespopulationall');
  }

  /**
   * Build the complete "All" lists for one dimension and store them on the
   * element data as two index-aligned lists (codes and names).
   *
   * @param {object} data the element data to store the lists on
   * @param {Array} translatedWeightedNames the weighted translated names
   * @param {Array} weightedCodes the weighted country codes
   * @param {object} translator the translator for the remaining names, or null
   * @param {Function} comparer the name comparer used for sorting
   * @param {string} namesProperty the destination property for the names
   * @param {string} codesProperty the destination property for the codes
   */
  buildAndStoreAllLists (data, translatedWeightedNames, weightedCodes,
    translator, comparer, namesProperty, codesProperty) {
    // Keep only codes that are real countries so the IP engine's sentinel
    // (e.g. 'Unknown') never leads the list or is re-added below.
    const weightedTuples = buildWeightedTuples(
      translatedWeightedNames, weightedCodes, comparer)
      .filter((tuple) => this.validCodes.has(String(tuple.code).toLowerCase()));

    const weightedCodeSet = new Set(weightedTuples.map((tuple) => tuple.code));
    let remaining = this.allCountries.filter(
      (country) => !weightedCodeSet.has(country.code));
    if (translator !== null) {
      remaining = remaining.map((country) => ({
        code: country.code,
        name: translator.translateString(country.englishName, []) ||
          country.englishName
      }));
    } else {
      remaining = remaining.map((country) => ({
        code: country.code,
        name: country.englishName
      }));
    }
    remaining.sort((a, b) => comparer(a.name, b.name));

    const all = weightedTuples.concat(remaining);
    data.contents[codesProperty] = new AspectPropertyValue(
      null, all.map((tuple) => tuple.code));
    data.contents[namesProperty] = new AspectPropertyValue(
      null, all.map((tuple) => tuple.name));
  }

  /**
   * Resolve a translator and matched locale from the evidence, checking the
   * evidence keys in precedence order. English and unknown languages resolve
   * to no translator (the names stay English).
   *
   * @param {object} flowData the flow data being processed
   * @returns {object|null} an object with `translator` and `matchedLocale`, or
   * null when no translator resolves
   */
  resolveTranslator (flowData) {
    const evidence = flowData.evidence.getAll();
    const lowered = {};
    Object.keys(evidence).forEach((key) => {
      lowered[key.toLowerCase()] = evidence[key];
    });
    for (const key of evidenceKeys) {
      const value = lowered[key];
      if (typeof value === 'string' && value.trim() !== '') {
        const resolved = this.languages.getTranslator(value);
        if (resolved !== null) {
          return resolved;
        }
      }
    }
    return null;
  }
}

CountriesTranslationEngine.createComparer = createComparer;

module.exports = CountriesTranslationEngine;
