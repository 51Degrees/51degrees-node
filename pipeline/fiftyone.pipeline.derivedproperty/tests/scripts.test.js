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
 * Reading and running scripts, as docs/format-1.md of derived-properties
 * describes, for the points the case files do not reach.
 */

const { validateText } = require('../lib/validate');
const { evaluate, USUAL_CAUSES } = require('../lib/evaluate');
const { canonical } = require('../lib/canonical');

/**
 * A script comparing one source property with a literal.
 *
 * @param {string} condition the When condition, as YAML flow text.
 * @param {string} [valueType] the output value type.
 * @returns {string} the script.
 */
function scriptWith (condition, valueType = 'string') {
  const [then, otherwise] = valueType === 'bool'
    ? ['true', 'false']
    : ['"Yes"', '"No"'];
  return [
    'Format: 1',
    'Name: Demo',
    'Version: 1.0.0',
    'Output:',
    '  Name: Demo',
    '  Description: A demonstration.',
    `  ValueType: ${valueType}`,
    '  IsList: false',
    'Rules:',
    `  - When: ${condition}`,
    `    Then: ${then}`,
    `  - Else: ${otherwise}`
  ].join('\n');
}

/**
 * The model of a script that validates.
 *
 * @param {string} text the script.
 * @returns {object} the model.
 */
function modelOf (text) {
  const { model, faults } = validateText(text);
  expect(faults).toEqual([]);
  return model;
}

test('yes and no are strings, as the YAML core schema reads them', () => {
  const model = modelOf(scriptWith('{ Property: src.A, Eq: yes }'));
  expect(model.properties[0].type).toBe('string');
  expect(evaluate(model, { 'src.A': 'yes' }).value).toBe('Yes');
});

test('keys that differ only in case are refused', () => {
  const { model, faults } = validateText(
    scriptWith('{ Property: src.A, Eq: 1 }') + '\nname: Demo');
  expect(model).toBeNull();
  expect(faults[0].message).toContain('differ only in case');
});

test('keys are matched without regard to case', () => {
  const model = modelOf(scriptWith('{ property: src.A, eq: 1 }')
    .replace('ValueType', 'valuetype')
    .replace('Rules:', 'RULES:'));
  expect(evaluate(model, { 'SRC.a': 1 }).value).toBe('Yes');
});

test('a JSON script gives the same model as its YAML', () => {
  const yaml = modelOf(scriptWith('{ Property: src.A, Ge: 8 }'));
  const json = modelOf(JSON.stringify({
    Format: 1,
    Name: 'Demo',
    Version: '1.0.0',
    Output: {
      Name: 'Demo',
      Description: 'A demonstration.',
      ValueType: 'string',
      IsList: false
    },
    Rules: [
      { When: { Property: 'src.A', Ge: 8 }, Then: 'Yes' },
      { Else: 'No' }
    ]
  }));
  expect(canonical(json)).toBe(canonical(yaml));
});

test('a whole number written with a point still infers int', () => {
  const model = modelOf(scriptWith('{ Property: src.A, Lt: 2.0 }'));
  expect(model.properties[0].type).toBe('int');
  expect(evaluate(model, { 'src.A': 1.5 }).missing).toEqual(['src.A']);
});

test('a whole number beyond an int infers double', () => {
  const model = modelOf(scriptWith('{ Property: src.A, Lt: 3000000000 }'));
  expect(model.properties[0].type).toBe('double');
});

test('an int is a signed 32 bit whole number', () => {
  const model = modelOf(scriptWith('{ Property: src.A, Ge: 0 }'));
  expect(evaluate(model, { 'src.A': 2147483647 }).value).toBe('Yes');
  expect(evaluate(model, { 'src.A': -2147483648 }).value).toBe('No');
  expect(evaluate(model, { 'src.A': 2147483648 }).missing)
    .toEqual(['src.A']);
  expect(evaluate(model, { 'src.A': { String: '3000000000' } }).missing)
    .toEqual(['src.A']);
});

test('values that mean nothing never become false or zero', () => {
  const bool = modelOf(scriptWith('{ Property: src.A, Eq: false }'));
  const int = modelOf(scriptWith('{ Property: src.A, Eq: 0 }'));
  for (const nothing of ['N/A', 'Unknown', '', '1', 'yes']) {
    expect(evaluate(bool, { 'src.A': nothing }).missing).toEqual(['src.A']);
  }
  for (const nothing of ['N/A', 'Unknown', '', '1.0']) {
    expect(evaluate(int, { 'src.A': nothing }).missing).toEqual(['src.A']);
  }
});

test('a native value read as a string takes its printed form', () => {
  const model = modelOf(scriptWith('{ Property: src.A, In: ["8", "True"] }'));
  expect(evaluate(model, { 'src.A': 8 }).value).toBe('Yes');
  expect(evaluate(model, { 'src.A': true }).value).toBe('Yes');
  expect(evaluate(model, { 'src.A': 9 }).value).toBe('No');
});

test('strings compare ordinally and with regard to case', () => {
  const model = modelOf(scriptWith('{ Property: src.A, StartsWith: "Mob" }'));
  expect(evaluate(model, { 'src.A': 'Mobile' }).value).toBe('Yes');
  expect(evaluate(model, { 'src.A': 'mobile' }).value).toBe('No');
});

test('a list of whole and decimal numbers reads as double', () => {
  const model = modelOf(scriptWith('{ Property: src.A, In: [1, 2.5] }'));
  expect(model.properties[0].type).toBe('double');
  expect(evaluate(model, { 'src.A': 2.5 }).value).toBe('Yes');
});

test('every fault in a script is reported together', () => {
  const { model, faults } = validateText(
    scriptWith('{ Property: A, Equals: 1 }').replace('Format: 1', 'Format: 2'));
  expect(model).toBeNull();
  expect(faults.map(fault => fault.path)).toEqual(
    expect.arrayContaining(['Format', 'Rules[0].When.Property']));
});

test('the message names every missing property in order', () => {
  const model = modelOf([
    'Format: 1',
    'Name: Demo',
    'Version: 1.0.0',
    'Output:',
    '  Name: Demo',
    '  Description: A demonstration.',
    '  ValueType: string',
    '  IsList: false',
    'Checks:',
    '  First: { Property: src.B, Eq: true }',
    'Rules:',
    '  - When: { Property: src.A, Eq: 1 }',
    '    Then: "Yes"',
    '  - Else: "No"'
  ].join('\n'));
  const result = evaluate(model, { 'src.A': { NoValue: 'Not today.' } });
  expect(result.missing).toEqual(['src.B', 'src.A']);
  expect(result.message).toBe("Derived property 'Demo' has no value " +
    'because 2 source properties were not available. ' +
    "'src.B' (element 'src' has no value for 'B': property not present " +
    "on this request). 'src.A' (element 'src' has no value for 'A': " +
    `Not today.). ${USUAL_CAUSES}`);
});

test('a bool output is a boolean', () => {
  const model = modelOf(scriptWith('{ Property: src.A, Eq: 1 }', 'bool'));
  expect(evaluate(model, { 'src.A': 1 }).value).toBe(true);
  expect(evaluate(model, { 'src.A': 2 }).value).toBe(false);
});
