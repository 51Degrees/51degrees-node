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
 * @example derivedProperty.js
 *
 * Derived properties are worked out from Properties other elements have
 * already put into the Flow Data, by scripts in the format of the
 * [derived-properties](https://github.com/51Degrees/derived-properties)
 * repository. This example builds the same Pipeline twice, once from the
 * configuration file derived-property-options.json and once in code, with
 * a script read from ReaderEngagement.yaml beside it and a second script
 * held as text in this file. Each Pipeline processes a request with every
 * source Property present and one with a source Property missing, which
 * shows what a caller sees then.
 *
 * It needs no resource key, no data file and no network, because a small
 * element, SessionElement, supplies the source Properties from the query
 * string.
 */

const fs = require('fs');
const core = require('fiftyone.pipeline.core');
const { DerivedPropertyElementBuilder } =
  require('fiftyone.pipeline.derivedproperty');
const SessionElement = require('./sessionElement');

// The script file and the configuration file beside this example.
const SCRIPT_FILE = 'ReaderEngagement.yaml';
const CONFIG_FILE = 'derived-property-options.json';

// The derived Properties the two scripts write.
const ENGAGEMENT = 'ReaderEngagement';
const EVERY_TEST = 'ReaderEngagementIsHigh';

// A second script, held as text by this example's own code.
const EVERY_TEST_SCRIPT = [
  'Format: 1',
  `Name: ${EVERY_TEST}`,
  'Version: "1.0.0"',
  'Output:',
  `  Name: ${EVERY_TEST}`,
  '  Description: Whether every one of the ReaderEngagement tests passed ' +
    'on this request.',
  '  ValueType: bool',
  '  IsList: false',
  '  Category: Example',
  'Checks:',
  '  SeveralPages: { Property: session.PagesViewed, Ge: 3 }',
  '  LongEnough:   { Property: session.SecondsSincePageLoad, Ge: 30 }',
  '  PointerMoved: { Property: session.PointerMoved, Eq: true }',
  'Rules:',
  '  - When: { Failed: Checks, Eq: 0 }',
  '    Then: true',
  '  - Else: false',
  ''
].join('\n');

// The source Properties the session element gives.
const SESSION_PROPERTIES =
  ['PagesViewed', 'SecondsSincePageLoad', 'PointerMoved'];

// A request with every source Property, and one without PointerMoved.
const EVERY_PROPERTY = {
  'query.pagesviewed': '5',
  'query.secondssincepageload': '120',
  'query.pointermoved': 'true'
};
const NO_POINTER = {
  'query.pagesviewed': '5',
  'query.secondssincepageload': '120'
};

// Only the elements this example adds, so the output shows just them.
const SETTINGS = {
  addJavaScriptBuilder: false,
  useSetHeaderProperties: false
};

// Where to go next, printed at the end of the example.
const FIND_OUT_MORE = [
  '',
  '='.repeat(79),
  'Find out more:',
  '\tThe scripts and the format reference: https://github.com/51Degrees/derived-properties',
  '\tThe Pipeline API: https://github.com/51Degrees/51degrees-node/tree/main/pipeline',
  '\tPipeline API documentation: https://51degrees.com/documentation/_pipeline_api__concepts__pipeline_basics.html?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.derivedproperty-examples-derivedproperty.js&utm_term=find-out-more-documentation',
  '\tContact us: https://51degrees.com/contact-us?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.derivedproperty-examples-derivedproperty.js&utm_term=find-out-more-contact'
].join('\n');

/**
 * A value as the example prints it, being the value, or that there is
 * none and why.
 *
 * @param {object} value an AspectPropertyValue
 * @returns {string} the text to print
 */
const describe = (value) => value.hasValue
  ? String(value.value)
  : `no value. ${value.noValueMessage}`;

/**
 * Processes one request and prints the source Properties and the derived
 * ones.
 *
 * @param {object} pipeline the Pipeline
 * @param {string} title what the request is
 * @param {object} evidence the request's query string parameters
 * @param {string[]} derivedNames the derived Properties to print
 */
const processRequest = async (pipeline, title, evidence, derivedNames) => {
  console.log(title);
  const flowData = pipeline.createFlowData();
  for (const [key, value] of Object.entries(evidence)) {
    flowData.evidence.add(key, value);
  }
  await flowData.process();

  // The source Properties, read as any element's Properties are read.
  const session = flowData.get('session');
  for (const name of SESSION_PROPERTIES) {
    console.log(`  session.${name}: ${describe(session.get(name))}`);
  }

  // The derived Properties, which the element writes under the key derived.
  const derived = flowData.get('derived');
  for (const name of derivedNames) {
    console.log(`  derived.${name}: ${describe(derived.get(name))}`);
  }
  console.log('');
};

/**
 * Builds the Pipeline from the configuration file, which names the session
 * element and the derived property element and gives the script file as a
 * setting.
 */
const runFromConfiguration = async () => {
  console.log('='.repeat(79));
  console.log(`1. Built from ${CONFIG_FILE}`);
  console.log('');
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const pipeline = new core.PipelineBuilder(SETTINGS)
    .buildFromConfiguration(config);

  await processRequest(pipeline,
    'Request 1, every source Property present.', EVERY_PROPERTY,
    [ENGAGEMENT]);
  await processRequest(pipeline,
    'Request 2, session.PointerMoved missing.', NO_POINTER, [ENGAGEMENT]);
  console.log('The second request has no value at all, because a Property ' +
    'the script names was');
  console.log('missing. The message says which Property was missing and ' +
    'what the element that');
  console.log('supplies it said, rather than answering on part of the ' +
    'evidence.');
  console.log('');
};

/**
 * Builds the same Pipeline in code, with the script file and the script
 * held as text.
 */
const runFromCode = async () => {
  console.log('='.repeat(79));
  console.log('2. Built in code');
  console.log('');
  const derived = new DerivedPropertyElementBuilder()
    .addScriptFile(SCRIPT_FILE)
    .addScript(EVERY_TEST, EVERY_TEST_SCRIPT)
    .build();
  const pipeline = new core.PipelineBuilder(SETTINGS)
    .add(new SessionElement())
    .add(derived)
    .build();

  await processRequest(pipeline,
    'Request 1, every source Property present.', EVERY_PROPERTY,
    [ENGAGEMENT, EVERY_TEST]);
  await processRequest(pipeline,
    'Request 2, session.PointerMoved missing.', NO_POINTER,
    [ENGAGEMENT, EVERY_TEST]);
  console.log('One element runs both scripts, so both Properties are ' +
    'written under the key');
  console.log('derived, and both have no value for the second request, ' +
    'as they read the same');
  console.log('source Properties.');
};

const run = async () => {
  // The script file and the configuration file, which names the session
  // element by its path, are found beside this example.
  process.chdir(__dirname);
  await runFromConfiguration();
  await runFromCode();
  console.log(FIND_OUT_MORE);
};

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
