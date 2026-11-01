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
const yaml = require('js-yaml');

const core = require('fiftyone.pipeline.core');
const AspectPropertyValue = core.AspectPropertyValue;
const ElementDataDictionary = core.ElementDataDictionary;
const FlowElement = core.FlowElement;
const PipelineBuilder = core.PipelineBuilder;
const BasicListEvidenceKeyFilter = core.BasicListEvidenceKeyFilter;

const CountryCodeTranslationEngine =
  require('../countryCodeTranslationEngine');
const CountryCodeTranslationEngineBuilder =
  require('../countryCodeTranslationEngineBuilder');
const CountriesTranslationEngine = require('../countriesTranslationEngine');
const CountriesTranslationEngineBuilder =
  require('../countriesTranslationEngineBuilder');
const createComparer = require('..').createComparer;

// The translation YAML files, read from the cxx submodule.
const translationsDir = path.join(__dirname, '..', '..', '..', 'cxx',
  'ip-intelligence-data', 'Translations');
const codeToEnglish = yaml.load(fs.readFileSync(
  path.join(translationsDir, 'countrycodes.en_GB.yml'), 'utf8'));
const frenchNames = yaml.load(fs.readFileSync(
  path.join(translationsDir, 'OSM', 'countries.fr_FR.yml'), 'utf8'));

/**
 * Look up the French translation of a country code, mirroring the engine's
 * code -> English -> French path and the Original missing behaviour.
 *
 * @param {string} code the ISO country code
 * @returns {string} the expected French country name
 */
const expectedFrench = (code) => {
  const english = codeToEnglish[code];
  const key = Object.keys(frenchNames).find(
    (k) => k.toLowerCase() === String(english).toLowerCase());
  return key !== undefined ? frenchNames[key] : english;
};

/**
 * Assign descending raw weights to a list of country codes so the first entry
 * has the highest weight. Mirrors the .NET test helper of the same purpose.
 *
 * @param {Array<string>} codes the country codes
 * @returns {Array<object>} the weighted value list
 */
const weightify = (codes) => {
  if (codes.length === 0) {
    return [];
  }
  let weightLeft = 65535;
  const buckets = new Array(codes.length);
  for (let i = 0; i < codes.length; i++) {
    buckets[i] = codes.length - i;
    weightLeft -= buckets[i];
  }
  const additional = Math.floor(weightLeft / codes.length);
  weightLeft -= additional * codes.length;
  for (let i = 0; i < codes.length; i++) {
    buckets[i] += additional;
  }
  buckets[0] += weightLeft;
  return codes.map((code, i) => ({
    value: code,
    weight: buckets[i] / 65535,
    rawWeight: buckets[i]
  }));
};

/**
 * Wrap raw (rawWeight, code) pairs as a weighted value list.
 *
 * @param {Array<Array>} pairs array of [rawWeight, code] pairs
 * @returns {Array<object>} the weighted value list
 */
const weighted = (pairs) => pairs.map(([rawWeight, code]) => ({
  value: code,
  weight: rawWeight / 65535,
  rawWeight
}));

/**
 * Create a mock IP intelligence flow element that exposes the supplied
 * weighted country code lists under the 'ip' element data key.
 *
 * @param {Array<object>} geographical the geographical weighted codes
 * @param {Array<object>} population the population weighted codes
 * @returns {FlowElement} the mock flow element
 */
const mockIpElement = (geographical, population) => new FlowElement({
  dataKey: 'ip',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter([]),
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: {
        countrycodesgeographical: new AspectPropertyValue(null, geographical),
        countrycodespopulation: new AspectPropertyValue(null, population)
      }
    }));
  }
});

/**
 * Build and process a pipeline of the mock IP element plus the two
 * translation engines, returning the processed flow data.
 *
 * @param {object} options the options object
 * @param {Array<object>} options.geographical geographical weighted codes
 * @param {Array<object>} options.population population weighted codes
 * @param {object} [options.evidence] evidence key/value pairs to add
 * @param {boolean} [options.namesOnly] when true, only add the first engine
 * @param {FlowElement} [options.engine1] override for the first engine
 * @param {FlowElement} [options.engine2] override for the second engine
 * @returns {Promise<object>} the processed flow data
 */
const process = async ({
  geographical, population, evidence, namesOnly, engine1, engine2
}) => {
  const builder = new PipelineBuilder()
    .add(mockIpElement(geographical, population))
    .add(engine1 || new CountryCodeTranslationEngineBuilder().build());
  if (!namesOnly) {
    builder.add(engine2 || new CountriesTranslationEngineBuilder().build());
  }
  const pipeline = builder.build();
  const flowData = pipeline.createFlowData();
  if (evidence) {
    Object.keys(evidence).forEach((key) =>
      flowData.evidence.add(key, evidence[key]));
  }
  await flowData.process();
  return flowData;
};

/**
 * Assert that a list of names is in non-descending order according to the
 * supplied comparer.
 *
 * @param {Array<string>} names the names to check
 * @param {Function} comparer the comparer to use
 */
const expectSorted = (names, comparer) => {
  for (let i = 1; i < names.length; i++) {
    expect(comparer(names[i - 1], names[i])).toBeLessThanOrEqual(0);
  }
};

// ---------------------------------------------------------------------------
// 10a. Ported from the .NET TranslationTests suite.
// ---------------------------------------------------------------------------

/**
 * Engine 1 alone: codes GB,FR become names United Kingdom, France (for both
 * the geographical and population dimensions).
 */
test('CountryNamesFromCodes', async () => {
  const flowData = await process({
    geographical: weightify(['GB', 'FR']),
    population: weightify(['GB', 'FR']),
    namesOnly: true
  });

  const result = flowData.get('countrynames');
  const geo = result.get('countrynamesgeographical');
  const pop = result.get('countrynamespopulation');
  expect(geo.hasValue).toBe(true);
  expect(pop.hasValue).toBe(true);
  expect(geo.value).toHaveLength(2);
  expect(pop.value).toHaveLength(2);
  expect(geo.value[0].value).toBe('United Kingdom');
  expect(geo.value[1].value).toBe('France');
  expect(pop.value[0].value).toBe('United Kingdom');
  expect(pop.value[1].value).toBe('France');
});

/**
 * Engines 1 and 2 with fr_FR: GB,FR become Royaume-Uni, France (weighted,
 * translated).
 */
test('TranslatedCountry', async () => {
  const flowData = await process({
    geographical: weightify(['GB', 'FR']),
    population: weightify(['GB', 'FR']),
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const result = flowData.get('countrynamestranslated');
  const geo = result.get('countrynamesgeographicaltranslated');
  const pop = result.get('countrynamespopulationtranslated');
  expect(geo.hasValue).toBe(true);
  expect(pop.hasValue).toBe(true);
  expect(geo.value).toHaveLength(2);
  expect(pop.value).toHaveLength(2);
  expect(geo.value[0].value).toBe('Royaume-Uni');
  expect(geo.value[1].value).toBe('France');
});

/**
 * Explicit weights (FR=30000, GB=35535), fr_FR: GB then FR lead (weight
 * descending), over 200 countries, GB/FR not repeated, tail sorted by the
 * locale comparer.
 */
test('AllListsProducedCorrectlySorted', async () => {
  const flowData = await process({
    geographical: weighted([[30000, 'FR'], [35535, 'GB']]),
    population: weighted([[30000, 'FR'], [35535, 'GB']]),
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const result = flowData.get('countrynamestranslated');
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  const codesAll = result.get('countrycodesgeographicalall').value;

  expect(namesAll).toHaveLength(codesAll.length);
  expect(namesAll[0]).toBe('Royaume-Uni');
  expect(codesAll[0]).toBe('GB');
  expect(namesAll[1]).toBe('France');
  expect(codesAll[1]).toBe('FR');
  expect(namesAll.length).toBeGreaterThan(200);
  expect(codesAll.slice(2)).not.toContain('GB');
  expect(codesAll.slice(2)).not.toContain('FR');

  const comparer = createComparer(result.get('sortingcultureused'));
  expectSorted(namesAll.slice(2), comparer);
});

/**
 * As above, with weights assigned by input order.
 */
test('AllListsProducedCorrectly', async () => {
  const flowData = await process({
    geographical: weightify(['GB', 'FR']),
    population: weightify(['GB', 'FR']),
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const result = flowData.get('countrynamestranslated');
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  const codesAll = result.get('countrycodesgeographicalall').value;

  expect(namesAll).toHaveLength(codesAll.length);
  expect(namesAll[0]).toBe('Royaume-Uni');
  expect(codesAll[0]).toBe('GB');
  expect(namesAll[1]).toBe('France');
  expect(codesAll[1]).toBe('FR');
  expect(namesAll.length).toBeGreaterThan(200);
  expect(codesAll.slice(2)).not.toContain('GB');
  expect(codesAll.slice(2)).not.toContain('FR');

  const comparer = createComparer(result.get('sortingcultureused'));
  expectSorted(namesAll.slice(2), comparer);
});

/**
 * No evidence: English names, GB first, tail alphabetical.
 */
test('AllListsWithoutLanguage', async () => {
  const flowData = await process({
    geographical: weightify(['GB']),
    population: weightify(['GB'])
  });

  const result = flowData.get('countrynamestranslated');
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  const codesAll = result.get('countrycodesgeographicalall').value;

  expect(namesAll[0]).toBe('United Kingdom');
  expect(codesAll[0]).toBe('GB');
  expect(namesAll.length).toBeGreaterThan(200);
  expect(result.get('sortingcultureused')).toBe('');

  const comparer = createComparer('');
  expectSorted(namesAll.slice(1), comparer);
});

/**
 * No weighted codes, de_DE: every country present, fully alphabetical.
 */
test('AllListsWithNoIpData', async () => {
  const flowData = await process({
    geographical: [],
    population: [],
    evidence: { 'header.Accept-Language': 'de_DE' }
  });

  const result = flowData.get('countrynamestranslated');
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  const codesAll = result.get('countrycodesgeographicalall').value;

  expect(namesAll.length).toBeGreaterThan(200);
  expect(namesAll).toHaveLength(codesAll.length);
  const comparer = createComparer(result.get('sortingcultureused'));
  expectSorted(namesAll, comparer);
});

/**
 * geo DE, pop US,CN: geo[0]=DE, pop[0]=US, pop[1]=CN.
 */
test('PopulationAndGeographicalAreIndependent', async () => {
  const flowData = await process({
    geographical: weightify(['DE']),
    population: weightify(['US', 'CN'])
  });

  const result = flowData.get('countrynamestranslated');
  const geoCodes = result.get('countrycodesgeographicalall').value;
  const popCodes = result.get('countrycodespopulationall').value;

  expect(geoCodes[0]).toBe('DE');
  expect(popCodes[0]).toBe('US');
  expect(popCodes[1]).toBe('CN');
  expect(popCodes[0]).not.toBe('DE');
});

/**
 * de_DE: Deutschland weighted and first in the All list.
 */
test('GermanTranslation', async () => {
  const flowData = await process({
    geographical: weightify(['DE']),
    population: weightify(['DE']),
    evidence: { 'header.Accept-Language': 'de_DE' }
  });

  const result = flowData.get('countrynamestranslated');
  expect(result.get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('Deutschland');
  expect(result.get('countrynamesgeographicalalltranslated').value[0])
    .toBe('Deutschland');
  expect(result.get('countrycodesgeographicalall').value[0]).toBe('DE');
});

/**
 * fr-FR (dash) resolves the same as fr_FR.
 */
test('AcceptLanguageWithDash', async () => {
  const flowData = await process({
    geographical: weightify(['GB']),
    population: weightify(['GB']),
    evidence: { 'header.Accept-Language': 'fr-FR' }
  });

  const result = flowData.get('countrynamestranslated');
  expect(result.get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('Royaume-Uni');
});

/**
 * en-US,en;q=0.9: names stay English.
 */
test('EnglishLanguageNoTranslation', async () => {
  const flowData = await process({
    geographical: weightify(['FR', 'DE']),
    population: weightify(['FR', 'DE']),
    evidence: { 'header.Accept-Language': 'en-US,en;q=0.9' }
  });

  const result = flowData.get('countrynamestranslated');
  const geo = result.get('countrynamesgeographicaltranslated').value;
  expect(geo[0].value).toBe('France');
  expect(geo[1].value).toBe('Germany');
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  expect(namesAll[0]).toBe('France');
  expect(namesAll[1]).toBe('Germany');
});

/**
 * en-US,en;q=0.9,de-DE;q=0.5: English wins, no German.
 */
test('EnglishPreferredOverOtherLanguages', async () => {
  const flowData = await process({
    geographical: weightify(['DE']),
    population: weightify(['DE']),
    evidence: { 'header.Accept-Language': 'en-US,en;q=0.9,de-DE;q=0.5,fr;q=0.3' }
  });

  const result = flowData.get('countrynamestranslated');
  expect(result.get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('Germany');
});

/**
 * es,de-DE;q=0.8,fr;q=0.5: Spanish Alemania (2-letter es resolves to es_ES).
 */
test('PreferredLanguageMatchedBeforeLowerPriority', async () => {
  const flowData = await process({
    geographical: weightify(['DE']),
    population: weightify(['DE']),
    evidence: { 'header.Accept-Language': 'es,de-DE;q=0.8,fr;q=0.5' }
  });

  const result = flowData.get('countrynamestranslated');
  expect(result.get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('Alemania');
});

/**
 * The IP engine sentinel 'Unknown' never appears; with no real codes the
 * lists are exactly all known countries ordered alphabetically.
 */
test('AllListsExcludeUnknownWhenNoRealCodes', async () => {
  const flowData = await process({
    geographical: weightify(['Unknown']),
    population: weightify(['Unknown']),
    evidence: { 'header.Accept-Language': 'de_DE' }
  });

  const result = flowData.get('countrynamestranslated');
  const codesAll = result.get('countrycodesgeographicalall').value;
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;

  expect(codesAll.length).toBeGreaterThan(200);
  expect(codesAll).not.toContain('Unknown');
  expect(namesAll).not.toContain('Unknown');
  expect(namesAll).toHaveLength(codesAll.length);
  const comparer = createComparer(result.get('sortingcultureused'));
  expectSorted(namesAll, comparer);
});

/**
 * A real code mixed with the 'Unknown' sentinel: the real country leads and
 * 'Unknown' is dropped entirely.
 */
test('AllListsExcludeUnknownWhenMixedWithRealCode', async () => {
  const flowData = await process({
    geographical: weightify(['DE', 'Unknown']),
    population: weightify(['DE', 'Unknown']),
    evidence: { 'header.Accept-Language': 'de_DE' }
  });

  const result = flowData.get('countrynamestranslated');
  const codesAll = result.get('countrycodesgeographicalall').value;
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;

  expect(codesAll[0]).toBe('DE');
  expect(namesAll[0]).toBe('Deutschland');
  expect(codesAll).not.toContain('Unknown');
  expect(namesAll).not.toContain('Unknown');
  expect(namesAll).toHaveLength(codesAll.length);
  const comparer = createComparer(result.get('sortingcultureused'));
  expectSorted(namesAll.slice(1), comparer);
});

// ---------------------------------------------------------------------------
// 10b. Gaps not covered by the current .NET tests.
// ---------------------------------------------------------------------------

/**
 * Gap 1: a bare query.translation translates, and query.translation overrides
 * a different header.accept-language (precedence).
 */
test('Gap1_EvidenceKeysAndPrecedence', async () => {
  const fromQuery = await process({
    geographical: weightify(['GB']),
    population: weightify(['GB']),
    evidence: { 'query.translation': 'fr_FR' }
  });
  expect(fromQuery.get('countrynamestranslated')
    .get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('Royaume-Uni');

  const overrides = await process({
    geographical: weightify(['DE']),
    population: weightify(['DE']),
    evidence: {
      'query.translation': 'es_ES',
      'header.Accept-Language': 'de_DE'
    }
  });
  expect(overrides.get('countrynamestranslated')
    .get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('Alemania');
});

/**
 * Gap 2: the raw weights survive translation and only the name changes.
 */
test('Gap2_WeightsPreservedThroughTranslation', async () => {
  const input = weighted([[35535, 'GB'], [30000, 'FR']]);
  const flowData = await process({
    geographical: input,
    population: input,
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const translated = flowData.get('countrynamestranslated')
    .get('countrynamesgeographicaltranslated').value;
  expect(translated[0].value).toBe('Royaume-Uni');
  expect(translated[0].rawWeight).toBe(35535);
  expect(translated[1].value).toBe('France');
  expect(translated[1].rawWeight).toBe(30000);
});

/**
 * Gap 3: two countries with the same weight appear in translated-name order
 * (the secondary sort). With equal weights, Allemagne (DE) precedes
 * Royaume-Uni (GB).
 */
test('Gap3_EqualWeightTieBreak', async () => {
  const equal = weighted([[30000, 'GB'], [30000, 'DE']]);
  const flowData = await process({
    geographical: equal,
    population: equal,
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const result = flowData.get('countrynamestranslated');
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  const codesAll = result.get('countrycodesgeographicalall').value;
  // Allemagne sorts before Royaume-Uni.
  expect(namesAll[0]).toBe('Allemagne');
  expect(codesAll[0]).toBe('DE');
  expect(namesAll[1]).toBe('Royaume-Uni');
  expect(codesAll[1]).toBe('GB');
});

/**
 * Gap 4: an unknown locale falls back to English with every property still
 * populated.
 */
test('Gap4_UnknownLocaleFallsBackToEnglish', async () => {
  const flowData = await process({
    geographical: weightify(['FR']),
    population: weightify(['FR']),
    evidence: { 'header.Accept-Language': 'zz-ZZ' }
  });

  const result = flowData.get('countrynamestranslated');
  expect(result.get('countrynamesgeographicaltranslated').value[0].value)
    .toBe('France');
  expect(result.get('sortingcultureused')).toBe('');
  expect(result.get('countrynamesgeographicalalltranslated').value.length)
    .toBeGreaterThan(200);
  expect(result.get('countrycodesgeographicalall').value).toHaveLength(
    result.get('countrynamesgeographicalalltranslated').value.length);
});

/**
 * Gap 5: a known English name absent from a locale map is returned unchanged.
 * Uses a custom resource fixture, since the shipped data is complete.
 */
test('Gap5_MissingSingleNameStaysEnglish', async () => {
  const engine1 = new CountryCodeTranslationEngine({
    sources: { 'countrycodes.en_GB.yml': 'FR: France\nDE: Germany\n' }
  });
  const engine2 = new CountriesTranslationEngine({
    // The fr_FR map deliberately omits Germany.
    sources: { 'countries.fr_FR.yml': 'France: France\n' },
    allCountries: [
      { code: 'FR', englishName: 'France' },
      { code: 'DE', englishName: 'Germany' }
    ]
  });
  const flowData = await process({
    geographical: weightify(['FR', 'DE']),
    population: weightify(['FR', 'DE']),
    evidence: { 'header.Accept-Language': 'fr_FR' },
    engine1,
    engine2
  });

  const result = flowData.get('countrynamestranslated');
  const codesAll = result.get('countrycodesgeographicalall').value;
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  const byCode = {};
  codesAll.forEach((code, i) => { byCode[code] = namesAll[i]; });
  // France is in the map and translates; Germany is not and stays English.
  expect(byCode.FR).toBe('France');
  expect(byCode.DE).toBe('Germany');
});

/**
 * Gap 6: for every index, including the alphabetical tail, the code and the
 * translated name are aligned.
 */
test('Gap6_FullIndexAlignment', async () => {
  const flowData = await process({
    geographical: weightify(['GB', 'FR']),
    population: weightify(['GB', 'FR']),
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const result = flowData.get('countrynamestranslated');
  const codesAll = result.get('countrycodesgeographicalall').value;
  const namesAll = result.get('countrynamesgeographicalalltranslated').value;
  expect(codesAll.length).toBe(namesAll.length);
  for (let i = 0; i < codesAll.length; i++) {
    expect(namesAll[i]).toBe(expectedFrench(codesAll[i]));
  }
});

/**
 * Gap 7: SortingCultureUsed equals the resolved culture for French and is
 * empty for English.
 */
test('Gap7_SortingCultureUsed', async () => {
  const french = await process({
    geographical: weightify(['GB']),
    population: weightify(['GB']),
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });
  expect(french.get('countrynamestranslated').get('sortingcultureused'))
    .toBe('fr-FR');

  const english = await process({
    geographical: weightify(['GB']),
    population: weightify(['GB']),
    evidence: { 'header.Accept-Language': 'en-US,en;q=0.9' }
  });
  expect(english.get('countrynamestranslated').get('sortingcultureused'))
    .toBe('');
});

/**
 * Gap 8: the population All list carries correctly translated names and can
 * differ from the geographical list.
 */
test('Gap8_PopulationTranslatedNames', async () => {
  const flowData = await process({
    geographical: weightify(['DE']),
    population: weightify(['FR']),
    evidence: { 'header.Accept-Language': 'fr_FR' }
  });

  const result = flowData.get('countrynamestranslated');
  const geoNames = result.get('countrynamesgeographicalalltranslated').value;
  const popNames = result.get('countrynamespopulationalltranslated').value;

  // Population leads with the translated France, geographical with Allemagne.
  expect(popNames[0]).toBe('France');
  expect(result.get('countrycodespopulationall').value[0]).toBe('FR');
  expect(geoNames[0]).toBe('Allemagne');
  expect(popNames[0]).not.toBe(geoNames[0]);
});
