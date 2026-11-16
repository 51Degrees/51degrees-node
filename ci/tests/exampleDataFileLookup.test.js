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

// Every example that looks for one of the free data files reads the
// environment variable that names it first, so that a run on a machine or
// in a job that already has the file uses the copy it has rather than
// downloading another. The example helpers have two lookups. findDataFile
// and findDeviceDataFile read the variable and then fall back to the file
// in the repository, and findFile only looks for the file, which is right
// for an evidence or CSV file and wrong for a data file.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FOLDERS = ['device-detection', 'ip-intelligence', 'location', 'pipeline'];

// Folders that hold no example of ours: installed packages, the scripts a
// page loads and the JavaScript templates submodule.
const SKIPPED_FOLDERS = ['node_modules', 'public', 'javascript-templates'];

// The names the examples give the free data files, and the endings of the
// data file names themselves.
const DATA_FILE_NAMES = [
  'LITE_V_4_1_HASH',
  'LITE_V_4_1_IPI',
  'ASN_V_4_1_IPI'
];
const DATA_FILE_ENDINGS = ['.hash', '.ipi'];

// Every example file, which is every .js and .ts file below an examples
// folder other than a test.
const exampleFiles = () => {
  const found = [];
  const pending = FOLDERS.map((folder) => ({
    dir: path.join(ROOT, folder), inExamples: false
  }));
  while (pending.length > 0) {
    const { dir, inExamples } = pending.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.includes(entry.name)) {
          pending.push({
            dir: full, inExamples: inExamples || entry.name === 'examples'
          });
        }
      } else if (inExamples && /\.(js|ts)$/.test(entry.name) &&
        !/\.test\.(js|ts)$/.test(entry.name)) {
        found.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  }
  return found.sort();
};

// The argument of each findFile call in the text, taken by counting
// parentheses so that a call written over several lines is read whole.
const findFileArguments = (text) => {
  const found = [];
  const opener = 'findFile(';
  let at = text.indexOf(opener);
  while (at !== -1) {
    let depth = 0;
    let end = at + opener.length - 1;
    for (; end < text.length; end++) {
      if (text[end] === '(') {
        depth++;
      } else if (text[end] === ')') {
        depth--;
        if (depth === 0) {
          break;
        }
      }
    }
    found.push(text.slice(at + opener.length, end));
    at = text.indexOf(opener, end);
  }
  return found;
};

// True when the argument names a data file rather than an evidence file or
// a path the caller gave.
const namesADataFile = (argument) =>
  DATA_FILE_NAMES.some((name) => argument.includes(name)) ||
  DATA_FILE_ENDINGS.some((ending) => argument.includes(ending + "'") ||
    argument.includes(ending + '"'));

// Each example with the findFile arguments that name a data file.
const looking = exampleFiles()
  .map((file) => ({
    file,
    named: findFileArguments(
      fs.readFileSync(path.join(ROOT, file), 'utf8')).filter(namesADataFile)
  }));

describe('how the examples look for a data file', () => {
  test('the examples are found', () => {
    expect(looking.length).toBeGreaterThan(0);
  });

  describe.each(looking.map((e) => [e.file, e.named]))(
    '%s', (file, found) => {
      test('reads the environment variable before the repository', () => {
        expect(found).toEqual([]);
      });
    });
});
