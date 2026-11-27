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

// Warnings are errors in a native build only when
// _51DEGREES_WARNINGS_AS_ERRORS is "true" when gyp configures. The builds
// CI runs set it, and a build on a customer's machine shows its warnings
// and never fails on one. These tests read each binding.51d as gyp does and
// run the command it reads the variable with.

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const REPOSITORY_ROOT = path.join(__dirname, '..', '..');

const BINDINGS = [
  'device-detection/fiftyone.devicedetection.onpremise/binding.51d',
  'ip-intelligence/fiftyone.ipintelligence.onpremise/binding.51d'
];

const NAME = '_51DEGREES_WARNINGS_AS_ERRORS';

// The settings that turn a warning into an error, for MSVC's compiler,
// librarian and linker.
const MSVC_SETTINGS = new Set([
  'WarnAsError', 'TreatLibWarningAsErrors', 'TreatLinkerWarningAsErrors',
  'TreatWarningAsError'
]);

// The options that turn a warning into an error for gcc, clang and MSVC.
const ERROR_OPTION = /^(-Werror\b|-Wfatal-errors\b|[-/]WX\b)/;

/**
 * Reads a gyp file, which is a Python literal of dictionaries, lists and
 * strings with comments, into the same values.
 *
 * @param {string} text the file's text
 * @returns {object} the values
 */
const parseGyp = (text) => {
  let at = 0;
  const skip = () => {
    for (;;) {
      while (at < text.length && /\s/.test(text[at])) at++;
      if (text[at] !== '#') return;
      while (at < text.length && text[at] !== '\n') at++;
    }
  };
  const fail = (what) => {
    throw new Error(`${what} at offset ${at}`);
  };
  const value = () => {
    skip();
    const c = text[at];
    if (c === '{') {
      at++;
      const result = {};
      for (;;) {
        skip();
        if (text[at] === '}') { at++; return result; }
        const key = value();
        skip();
        if (text[at] !== ':') fail('expected :');
        at++;
        result[key] = value();
        skip();
        if (text[at] === ',') at++;
      }
    }
    if (c === '[') {
      at++;
      const result = [];
      for (;;) {
        skip();
        if (text[at] === ']') { at++; return result; }
        result.push(value());
        skip();
        if (text[at] === ',') at++;
      }
    }
    if (c === '\'' || c === '"') {
      at++;
      let result = '';
      while (text[at] !== c) {
        if (at >= text.length) fail('unended string');
        if (text[at] === '\\') {
          const next = text[at + 1];
          // A backslash before a line end joins the lines, as in Python.
          if (next !== '\n') result += next;
          at += 2;
        } else {
          result += text[at++];
        }
      }
      at++;
      // Python joins strings that follow each other.
      skip();
      if (text[at] === '\'' || text[at] === '"') return result + value();
      return result;
    }
    const number = /^-?\d+/.exec(text.slice(at));
    if (number) {
      at += number[0].length;
      return Number(number[0]);
    }
    return fail('unexpected text');
  };
  const result = value();
  skip();
  if (at !== text.length) fail('text after the end');
  return result;
};

/**
 * Every key and value under a node, with the path of keys to it.
 *
 * @param {*} node the node
 * @param {string[]} trail the keys above the node
 * @returns {Array<{trail: string[], value: *}>} one entry per value
 */
const entries = (node, trail = []) => {
  if (Array.isArray(node)) {
    return node.flatMap((item, index) =>
      [{ trail: [...trail, String(index)], value: item },
        ...entries(item, [...trail, String(index)])]);
  }
  if (node !== null && typeof node === 'object') {
    return Object.entries(node).flatMap(([key, item]) =>
      [{ trail: [...trail, key], value: item },
        ...entries(item, [...trail, key])]);
  }
  return [];
};

const readBinding = (file) =>
  parseGyp(fs.readFileSync(path.join(REPOSITORY_ROOT, file), 'utf8'));

/**
 * Runs a gyp command expansion, <!(command), as gyp does, through the
 * shell, with the variable set to a value or left unset.
 *
 * @param {string} expansion the string from the gyp file
 * @param {string|undefined} setting the variable's value, or undefined
 * @returns {string} what the command printed, trimmed
 */
const expand = (expansion, setting) => {
  const command = /^<!\((.*)\)$/s.exec(expansion);
  expect(command).not.toBeNull();
  const env = { ...process.env };
  delete env[NAME];
  if (setting !== undefined) env[NAME] = setting;
  return childProcess.execSync(command[1], {
    cwd: REPOSITORY_ROOT, env, encoding: 'utf8'
  }).trim();
};

describe.each(BINDINGS)('%s', (file) => {
  let binding;

  beforeAll(() => {
    binding = readBinding(file);
  });

  it('reads the variable once when gyp configures', () => {
    const inner = binding.variables.variables;
    expect(inner).toBeDefined();
    expect(inner.warnings_as_errors).toMatch(/^<!\(node -p /);
    expect(inner.warnings_as_errors).toContain(`process.env.${NAME}`);
    expect(binding.variables.warnings_as_errors)
      .toBe('<(warnings_as_errors)');
  });

  it.each([
    [undefined, 'false'],
    ['', 'false'],
    ['true', 'true'],
    ['TRUE', 'true'],
    ['True', 'true'],
    ['false', 'false'],
    ['1', 'false'],
    ['yes', 'false'],
    [' true', 'false']
  ])('turns warnings into errors with %p: %s', (setting, expected) => {
    expect(expand(binding.variables.variables.warnings_as_errors, setting))
      .toBe(expected);
  });

  it('gives -Werror only when the variable is true', () => {
    expect(binding.variables.conditions).toEqual([[
      'warnings_as_errors=="true"',
      { linux_mac_warnings_as_errors_flags: ['-Werror'] },
      { linux_mac_warnings_as_errors_flags: [] }
    ]]);
    const fixed = entries(binding)
      .filter(({ trail, value }) => typeof value === 'string' &&
        ERROR_OPTION.test(value) &&
        trail.join('/') !== 'variables/conditions/0/1/' +
          'linux_mac_warnings_as_errors_flags/0')
      .map(({ trail, value }) => `${trail.join('/')}: ${value}`);
    expect(fixed).toEqual([]);
  });

  it('uses the switch wherever gcc and clang get the common flags', () => {
    const lists = entries(binding)
      .filter(({ value }) => Array.isArray(value) &&
        value.includes('<@(linux_mac_c_common_flags)'));
    expect(lists.length).toBeGreaterThan(0);
    for (const { trail, value } of lists) {
      expect({ trail: trail.join('/'), value }).toEqual({
        trail: trail.join('/'),
        value: expect.arrayContaining(
          ['<@(linux_mac_warnings_as_errors_flags)'])
      });
    }
  });

  it('sets every MSVC warnings as errors setting from the switch', () => {
    const settings = entries(binding)
      .filter(({ trail }) => MSVC_SETTINGS.has(trail[trail.length - 1]));
    expect(settings.length).toBeGreaterThan(0);
    for (const { trail, value } of settings) {
      expect({ trail: trail.join('/'), value })
        .toEqual({ trail: trail.join('/'), value: '<(warnings_as_errors)' });
    }
  });
});

describe('the builds CI runs', () => {
  const script = fs.readFileSync(
    path.join(REPOSITORY_ROOT, 'ci', 'build-extension.ps1'), 'utf8');

  it('set the variable to true before node-gyp configures', () => {
    const lines = script.split('\n');
    const sets = lines.findIndex((line) =>
      /^\$env:_51DEGREES_WARNINGS_AS_ERRORS = 'true'\s*$/.test(line));
    const configures = lines.findIndex((line) =>
      /node-?gyp.* configure/i.test(line) || /\$nodeGyp configure/.test(line));
    expect(sets).toBeGreaterThanOrEqual(0);
    expect(configures).toBeGreaterThan(sets);
  });

  it('leave it unset in the build a customer runs from the source', () => {
    const local = fs.readFileSync(path.join(REPOSITORY_ROOT,
      'ip-intelligence', 'ensure-native-module.js'), 'utf8');
    expect(local).not.toContain(NAME);
  });
});

describe('the gyp reader', () => {
  it('reads dictionaries, lists, strings, joins and comments', () => {
    expect(parseGyp(`{
      # a comment
      'a': [1, "two\\" quoted", 'jo' 'ined',],
      'b': {'c': 'line \\
continued'},
    }`)).toEqual({
      a: [1, 'two" quoted', 'joined'],
      b: { c: 'line continued' }
    });
  });
});
