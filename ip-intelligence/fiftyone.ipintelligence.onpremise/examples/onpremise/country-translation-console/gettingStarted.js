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
 * @example onpremise/country-translation-console/gettingStarted.js
 *
 * This example demonstrates the on-premise country translation engines. The
 * IP intelligence engine emits weighted lists of country codes; the two
 * translation engines turn those into localized, ordered lists of every
 * country, with the most probable country for the supplied IP address first
 * and the rest in alphabetical order.
 *
 * The example prints the geographical and population "All" lists (codes and
 * translated names) as ordered, comma-separated lists.
 *
 * This example is available in full on [GitHub](https://github.com/51Degrees/51degrees-node/blob/main/ip-intelligence/fiftyone.ipintelligence.onpremise/examples/onpremise/country-translation-console/gettingStarted.js).
 *
 * Required npm Dependencies:
 * - [fiftyone.pipeline.core](https://www.npmjs.com/package/fiftyone.pipeline.core)
 * - [fiftyone.pipeline.translation](https://www.npmjs.com/package/fiftyone.pipeline.translation)
 * - [fiftyone.ipintelligence.onpremise](https://www.npmjs.com/package/fiftyone.ipintelligence.onpremise)
 * - [fiftyone.ipintelligence.translation](https://www.npmjs.com/package/fiftyone.ipintelligence.translation)
 */

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../../../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const IpIntelligenceOnPremisePipelineBuilder =
  require51('fiftyone.ipintelligence.onpremise')
    .IpIntelligenceOnPremisePipelineBuilder;

const translation = require51('fiftyone.ipintelligence.translation');

const ExampleUtils =
  require(path.join(__dirname, '/../exampleUtils')).ExampleUtils;

// In this example, by default, the 51degrees "Lite" file needs to be in the
// cxx/data/ip-intelligence folder, where it is downloaded if missing,
// or you may specify another file as a command line parameter.
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

/**
 * Read an ordered "All" list from the translation element data, returning an
 * empty array when it is not present.
 *
 * @param {object} data the countrynamestranslated element data
 * @param {string} key the property key
 * @returns {Array<string>} the ordered list
 */
const listValue = (data, key) => {
  try {
    const value = data.get(key);
    return value && value.hasValue ? value.value : [];
  } catch (e) {
    return [];
  }
};

/**
 * Build the on-premise IP intelligence and country translation pipeline, look
 * up the supplied evidence, print the ordered "All" lists and return them.
 *
 * @param {string} dataFile the path to the IP intelligence data file
 * @param {object} output a writable stream (e.g. process.stdout)
 * @param {Map} [evidence] the evidence to process; defaults to a sample IP
 * address and the en-GB browser language
 * @returns {Promise<object>} the processed flow data and the ordered lists
 */
const run = async function (dataFile, output, evidence) {
  const pipeline = new IpIntelligenceOnPremisePipelineBuilder({
    performanceProfile: 'Balanced',
    dataFile,
    shareUsage: false,
    autoUpdate: false,
    updateOnStart: false,
    fileSystemWatcher: false
  })
    .add(new translation.CountryCodeTranslationEngineBuilder().build())
    .add(new translation.CountriesTranslationEngineBuilder().build())
    .build();

  const values = evidence || new Map([
    // An IP address to look up.
    ['query.client-ip', '2.125.160.216'],
    // The language to translate the country names into. Overrides the
    // Accept-Language header. Try 'fr-FR', 'de-DE', 'es-ES', etc.
    ['query.translation', 'en-GB']
  ]);

  let message = 'Input values:';
  for (const [key, value] of values) {
    message += `\n\t${key}: ${value}`;
  }
  output.write(message + '\n');

  const flowData = pipeline.createFlowData();
  values.forEach((value, key) => {
    flowData.evidence.add(key, value);
  });

  await flowData.process();

  const translated = flowData.get('countrynamestranslated');
  const result = {
    flowData,
    geographicalCodes: listValue(translated, 'countrycodesgeographicalall'),
    geographicalNames:
      listValue(translated, 'countrynamesgeographicalalltranslated'),
    populationCodes: listValue(translated, 'countrycodespopulationall'),
    populationNames:
      listValue(translated, 'countrynamespopulationalltranslated')
  };

  // The "All" lists are ordered with the most probable country first, then
  // every remaining country alphabetically by translated name. The codes and
  // names lists are index-aligned.
  output.write('\nGeographical (most probable country first):\n');
  output.write(`\tCodes: ${result.geographicalCodes.join(', ')}\n`);
  output.write(`\tNames: ${result.geographicalNames.join(', ')}\n`);
  output.write('\nPopulation (most probable country first):\n');
  output.write(`\tCodes: ${result.populationCodes.join(', ')}\n`);
  output.write(`\tNames: ${result.populationNames.join(', ')}\n\n`);

  ExampleUtils.checkDataFile(pipeline, dataFile);

  return result;
};

// Don't run the example if under TEST.
if (process.env.JEST_WORKER_ID === undefined) {
  const args = process.argv.slice(2);
  // Use the supplied path for the data file or find the lite file that is
  // included in the repository.
  const dataFile = args.length > 0
    ? args[0]
    : ExampleUtils.findFile(LITE_V_4_1_IPI);

  if (dataFile !== undefined) {
    run(dataFile, process.stdout);
  } else {
    console.error('Failed to find an IP intelligence data file. Make sure ' +
      'the cxx/data submodule has been fetched by running ' +
      '`git submodule update --init --recursive`.');
  }
};

module.exports = {
  run
};
