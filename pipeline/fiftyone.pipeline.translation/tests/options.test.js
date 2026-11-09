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

// The constructor options take the names the Translation Engine
// specification gives them, sourceElementDataKey and
// missingTranslationBehavior, and still take the deprecated sourceDataKey
// and behavior.

const path = require('path');
const core = require('fiftyone.pipeline.core');
const TranslationEngine = require('../translationEngine');
const MissingTranslationBehavior = require('../missingTranslationBehavior');
const CountrySourceElement = require('./countrySourceElement');

const REFUSED = 'is not one of Original, EmptyString or FlowError';

// What the engine answers for the known and the unknown country under each
// behavior, and whether it records a flow error.
const EXPECTED = {
  Original: { known: 'Allemagne', unknown: 'Atlantis', error: false },
  EmptyString: { known: 'Allemagne', unknown: '', error: false },
  FlowError: { known: 'Allemagne', unknown: null, error: true }
};

/**
 * The options every engine in these tests shares, with the language fixed
 * so that no evidence is needed.
 *
 * @returns {object} the options
 */
const shared = () => ({
  translations: [
    { source: 'known', destination: 'knowntranslated' },
    { source: 'unknown', destination: 'unknowntranslated' }
  ],
  sources: { 'countries.fr_FR.yml': '{Germany: Allemagne}' },
  fixedLanguage: 'fr_FR'
});

/**
 * Processes the pipeline once and answers with the two translated values
 * and whether the engine recorded a flow error.
 *
 * @param {object} pipeline the pipeline
 * @returns {Promise<object>} the values and whether there was an error
 */
const outcome = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  await flowData.process();
  const data = flowData.get('translation');
  return {
    known: data.get('knowntranslated'),
    unknown: data.get('unknowntranslated'),
    error: flowData.errors.translation !== undefined
  };
};

/**
 * Builds a pipeline of the source element and an engine with the options
 * given added to the shared ones, and processes it once.
 *
 * @param {object} options the options to add
 * @returns {Promise<object>} the values and whether there was an error
 */
const translate = (options) => outcome(
  new core.PipelineBuilder({ suppressProcessExceptions: true })
    .add(new CountrySourceElement())
    .add(new TranslationEngine(Object.assign(shared(), options)))
    .build());

describe('Translation Engine options', () => {
  test('the specification names are used', async () => {
    expect(await translate({
      sourceElementDataKey: 'ip',
      missingTranslationBehavior: MissingTranslationBehavior.EmptyString
    })).toEqual(EXPECTED.EmptyString);
  });

  test('the deprecated names still work', async () => {
    expect(await translate({
      sourceDataKey: 'ip',
      behavior: MissingTranslationBehavior.EmptyString
    })).toEqual(EXPECTED.EmptyString);
  });

  test('the specification names win when both are given', async () => {
    expect(await translate({
      sourceElementDataKey: 'ip',
      sourceDataKey: 'nothere',
      missingTranslationBehavior: 'EmptyString',
      behavior: 'FlowError'
    })).toEqual(EXPECTED.EmptyString);
  });

  test.each([
    ['Original', 'Original'],
    ['original', 'Original'],
    ['ORIGINAL', 'Original'],
    ['EmptyString', 'EmptyString'],
    ['emptystring', 'EmptyString'],
    ['EMPTYSTRING', 'EmptyString'],
    ['FlowError', 'FlowError'],
    ['flowerror', 'FlowError'],
    ['FLOWERROR', 'FlowError']
  ])('the text %s is the %s behavior', async (text, behavior) => {
    expect(await translate({
      sourceElementDataKey: 'ip',
      missingTranslationBehavior: text
    })).toEqual(EXPECTED[behavior]);
    expect(await translate({ sourceDataKey: 'ip', behavior: text }))
      .toEqual(EXPECTED[behavior]);
  });

  test.each([
    ['not given', {}],
    ['null', { missingTranslationBehavior: null }]
  ])('the behavior is Original when %s', async (name, options) => {
    expect(await translate(Object.assign({ sourceElementDataKey: 'ip' },
      options))).toEqual(EXPECTED.Original);
  });

  test.each([
    ['Ignore'],
    [''],
    ['Flow Error'],
    [3],
    [{}]
  ])('the behavior %p is refused when the engine is built', (value) => {
    const build = (options) => new TranslationEngine(
      Object.assign(shared(), { sourceElementDataKey: 'ip' }, options));
    expect(() => build({ missingTranslationBehavior: value }))
      .toThrow(REFUSED);
    expect(() => build({ behavior: value })).toThrow(REFUSED);
  });

  test('a configuration can use the specification names', async () => {
    const pipeline = new core.PipelineBuilder().buildFromConfiguration({
      PipelineOptions: {
        Elements: [
          { elementName: path.join(__dirname, 'countrySourceElement') },
          {
            elementName: path.join(__dirname, '..', 'translationEngine'),
            elementParameters: Object.assign(shared(), {
              sourceElementDataKey: 'ip',
              missingTranslationBehavior: 'FlowError'
            })
          }
        ],
        BuildParameters: { suppressProcessExceptions: true }
      }
    });
    expect(await outcome(pipeline)).toEqual(EXPECTED.FlowError);
  });
});
