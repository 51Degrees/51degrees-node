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
 * Runs every case file of the derived-properties submodule, which every
 * language runs, so that this package gives the same answer as the
 * reference tools, .NET, Rust and PHP for every case.
 */

const fs = require('fs');
const path = require('path');
const DerivedPropertyElementBuilder =
  require('../derivedPropertyElementBuilder');
const { ScriptSet } = require('../scriptSet');
const { ScriptValidationError } = require('../errors');
const { parse } = require('../lib/parse');
const { evaluate } = require('../lib/evaluate');
const {
  SUBMODULE,
  SourceElement,
  pipelineOf,
  processed
} = require('./helpers');

const TESTS = path.join(SUBMODULE, 'tests');
const INVALID = path.join(TESTS, 'invalid');

/**
 * Every value case, as [label, script name, case].
 *
 * @returns {Array} the cases.
 */
function valueCases () {
  const cases = [];
  for (const file of fs.readdirSync(TESTS).sort()) {
    if (!file.endsWith('.cases.yaml')) continue;
    const document = parse(fs.readFileSync(path.join(TESTS, file), 'utf8'))
      .document;
    for (const testCase of document.Cases) {
      cases.push([`${document.Script}: ${testCase.Name}`, document.Script,
        testCase]);
    }
  }
  return cases;
}

/**
 * Every rejection case, as [file name, document].
 *
 * @returns {Array} the cases.
 */
function rejectionCases () {
  return fs.readdirSync(INVALID)
    .filter(file => /\.ya?ml$/i.test(file))
    .sort()
    .map(file => [file, parse(fs.readFileSync(path.join(INVALID, file),
      'utf8')).document]);
}

/**
 * The names a no value message gives, in lower case and in order.
 *
 * @param {string} message the message.
 * @returns {string[]} the property names.
 */
function namesIn (message) {
  const names = [];
  const pattern = /'([A-Za-z][A-Za-z0-9]*\.[A-Za-z][A-Za-z0-9]*)' \(/g;
  let match;
  while ((match = pattern.exec(message)) !== null) {
    names.push(match[1].toLowerCase());
  }
  return names;
}

/**
 * Runs one case through a pipeline. Each element data key the script
 * reads gets an element listing every property the script reads under
 * that key, holding the values the case gives.
 *
 * @param {object} element the derived property element.
 * @param {object} testCase the case.
 * @param {boolean} wrap whether the values are AspectPropertyValues.
 * @returns {Promise<object>} the value written for the script.
 */
async function run (element, testCase, wrap) {
  const script = element.scripts[0];
  const byKey = new Map();
  const entryFor = written => {
    const [key, name] = written.split('.');
    const lower = key.toLowerCase();
    if (!byKey.has(lower)) byKey.set(lower, { names: [], values: {} });
    return { entry: byKey.get(lower), name };
  };
  for (const property of script.properties) {
    const { entry, name } = entryFor(property.name);
    entry.names.push(name);
  }
  for (const [written, value] of Object.entries(testCase.Properties ?? {})) {
    const { entry, name } = entryFor(written);
    entry.values[name] = value;
  }
  const sources = [...byKey.entries()].map(([key, entry]) =>
    new SourceElement(key, entry.values, { supplies: entry.names, wrap }));
  const flowData = await processed(pipelineOf([...sources, element]));
  return flowData.get('derived').get(script.output.Name);
}

const elements = new Map();

/**
 * The element running one built in script, made once.
 *
 * @param {string} name the script.
 * @returns {object} the element.
 */
function elementFor (name) {
  if (!elements.has(name)) {
    elements.set(name,
      new DerivedPropertyElementBuilder().addBuiltInScript(name).build());
  }
  return elements.get(name);
}

describe.each([['as AspectPropertyValues', true], ['as plain values', false]])(
  'every value case, with the values given %s', (_, wrap) => {
    test.each(valueCases())('%s', async (label, name, testCase) => {
      const element = elementFor(name);
      const value = await run(element, testCase, wrap);
      const reference = evaluate(element.scripts[0], testCase.Properties);
      if ('Value' in testCase.Expect) {
        expect(value.hasValue).toBe(true);
        expect(String(value.value)).toBe(String(testCase.Expect.Value));
      } else {
        expect(value.hasValue).toBe(false);
        const expected = testCase.Expect.Missing
          .map(property => property.toLowerCase())
          .sort();
        expect([...namesIn(value.noValueMessage)].sort()).toEqual(expected);
        // The element reads each value as the reference tools do, so it
        // gives the reference message word for word.
        expect(value.noValueMessage).toBe(reference.message);
        expect(() => value.value).toThrow(reference.message);
      }
    });
  });

test.each(rejectionCases())('the rejection case %s is refused', (file, document) => {
  const set = new ScriptSet();
  set.addText(document.Name ?? null, document.Script, file);
  let error;
  try {
    set.compile();
  } catch (thrown) {
    error = thrown;
  }
  expect(error).toBeInstanceOf(ScriptValidationError);
  // Each list is compared whole, so a failure shows every fault there was.
  const paths = error.faults.map(fault => fault.path);
  const messages = error.faults.map(fault => fault.message);
  for (const expected of document.Expect.Paths ?? []) {
    expect(paths).toContain(expected);
  }
  for (const fragment of document.Expect.Mentions ?? []) {
    expect(messages).toEqual(
      expect.arrayContaining([expect.stringContaining(fragment)]));
  }
});
