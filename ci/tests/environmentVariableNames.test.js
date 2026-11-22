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

// Every environment variable, secret and workflow variable this repository
// reads or sets is named _51DEGREES_<NAME>, so wherever it appears it is
// clearly a 51Degrees name. The only others are the names Node, jest,
// GitHub or PowerShell define, which are listed below.

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// The repository root, two levels above this file.
const REPOSITORY_ROOT = path.join(__dirname, '..', '..');

const PREFIX = '_51DEGREES_';

// A read or a write of a name: the two forms Node offers, the two
// PowerShell forms, and a secret or a variable in a workflow.
const NAME_USE = new RegExp('(?:' + [
  'process\\.env\\.',
  'process\\.env\\[\\s*[\'"]',
  '\\$env:',
  '\\$\\{env:',
  '\\bsecrets\\.',
  '\\bvars\\.'
].join('|') + ')([A-Za-z_][A-Za-z0-9_]*)', 'g');

// The names another tool defines, used as that tool requires.
const PLATFORM_NAMES = new Set([
  // Node
  'NODE_PATH',
  // jest and jest-junit
  'JEST_WORKER_ID', 'JEST_JUNIT_OUTPUT_DIR',
  // GitHub Actions
  'GITHUB_ACTIONS', 'GITHUB_JOB'
]);

// Reading a binary file as text yields no useful name and wastes time, so
// files that never carry one are skipped by extension.
const SKIPPED_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.svg', '.woff', '.woff2',
  '.ttf', '.eot', '.pdf', '.zip', '.gz', '.hash', '.ipi', '.dat', '.node'
]);

/**
 * Every file git tracks, which leaves out the submodules and anything a
 * build produced.
 *
 * @returns {string[]} the paths, relative to the repository root
 */
const trackedFiles = () => {
  const output = childProcess.execSync('git ls-files', {
    cwd: REPOSITORY_ROOT,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024
  });

  return output.split('\n').filter((line) => line.length > 0);
};

/**
 * The names a text reads or sets.
 *
 * @param {string} text the text to search
 * @returns {string[]} one entry per use
 */
const namesIn = (text) =>
  [...text.matchAll(NAME_USE)].map((match) => match[1]);

/**
 * Whether a name is one this repository may read or set.
 *
 * @param {string} name the name
 * @returns {boolean} true when it is a 51Degrees name or a platform name
 */
const isAllowed = (name) =>
  (name.startsWith(PREFIX) && name.length > PREFIX.length) ||
  PLATFORM_NAMES.has(name);

/**
 * Every use of a name that is not allowed, across the repository.
 *
 * @returns {string[]} one entry per use, with its file, line and name
 */
const otherNamesInRepository = () => {
  const found = [];

  for (const file of trackedFiles()) {
    const full = path.join(REPOSITORY_ROOT, file);
    if (SKIPPED_EXTENSIONS.has(path.extname(file).toLowerCase()) ||
      path.normalize(file) === path.join('ci', 'tests', path.basename(__filename)) ||
      !fs.existsSync(full) || !fs.statSync(full).isFile()) {
      continue;
    }
    fs.readFileSync(full, 'utf8').split('\n').forEach((line, index) => {
      for (const name of namesIn(line)) {
        if (!isAllowed(name)) {
          found.push(`${file}:${index + 1}: ${name}`);
        }
      }
    });
  }

  return found;
};

/**
 * The names every env block of a workflow sets, at any depth.
 *
 * @param {*} node a workflow, or any part of one
 * @returns {string[]} one entry per name
 */
const envNamesIn = (node) => {
  if (node === null || typeof node !== 'object') {
    return [];
  }
  const names = [];
  for (const [key, value] of Object.entries(node)) {
    if (key === 'env' && value !== null && typeof value === 'object') {
      names.push(...Object.keys(value));
    } else {
      names.push(...envNamesIn(value));
    }
  }
  return names;
};

describe('environment variable names', () => {
  it('reads and sets only 51Degrees names and platform names', () => {
    expect(otherNamesInRepository()).toEqual([]);
  });

  it('finds a name in each form it is read or set in', () => {
    // The dollar sign is kept apart so the text is not read as a template
    // string.
    const braced = '$' + '{env:_51DEGREES_DD_PATH} = $path';
    const secret = '$' + '{{ secrets._51DEGREES_LICENSE_KEY }}';
    const variable = '$' + '{{ vars._51DEGREES_CLOUD_ENDPOINT }}';

    expect(namesIn('process.env._51DEGREES_RESOURCE_KEY || undefined'))
      .toEqual(['_51DEGREES_RESOURCE_KEY']);
    expect(namesIn("process.env['_51DEGREES_IPI_PATH']"))
      .toEqual(['_51DEGREES_IPI_PATH']);
    expect(namesIn('$env:_51DEGREES_EXAMPLE_URL = $url'))
      .toEqual(['_51DEGREES_EXAMPLE_URL']);
    expect(namesIn(braced)).toEqual(['_51DEGREES_DD_PATH']);
    expect(namesIn(secret)).toEqual(['_51DEGREES_LICENSE_KEY']);
    expect(namesIn(variable)).toEqual(['_51DEGREES_CLOUD_ENDPOINT']);

    // A name read through a variable holding it is not a use, and neither
    // is prose that ends a sentence with one of the words.
    expect(namesIn('process.env[name]')).toEqual([]);
    expect(namesIn('The job is given no secrets. It runs without them.'))
      .toEqual([]);
  });

  it('sets only 51Degrees names and platform names in a workflow', () => {
    const found = [];
    const other = [];

    for (const file of trackedFiles()) {
      if (!/^\.github\/workflows\/.*\.ya?ml$/.test(file)) {
        continue;
      }
      const workflow = yaml.load(
        fs.readFileSync(path.join(REPOSITORY_ROOT, file), 'utf8'));
      for (const name of envNamesIn(workflow)) {
        found.push(name);
        if (!isAllowed(name)) {
          other.push(`${file}: ${name}`);
        }
      }
    }

    expect(found.length).toBeGreaterThan(0);
    expect(other).toEqual([]);
    expect(envNamesIn({ jobs: { a: { steps: [{ env: { PORT: 1 } }] } } }))
      .toEqual(['PORT']);
  });

  it('allows only a 51Degrees name or a platform name', () => {
    expect(isAllowed('_51DEGREES_RESOURCE_KEY_BESPOKE')).toBe(true);
    expect(isAllowed('JEST_WORKER_ID')).toBe(true);

    // The prefix alone names nothing.
    expect(isAllowed('_51DEGREES_')).toBe(false);
    // The prefix has to come first, underscore included.
    expect(isAllowed('MY_51DEGREES_NAME')).toBe(false);
    expect(isAllowed('EXAMPLE_NAME')).toBe(false);
    // Names keep their case, as Linux reads them.
    expect(isAllowed('_51degrees_dd_path')).toBe(false);
  });

  // A 51Did license redeems only with a resource key of the same account,
  // and the Basic tier test needs a key on that tier alone, so each key in
  // a workflow comes from the secret of its own name.
  it('fills each key in a workflow from the secret of the same name', () => {
    const assignment =
      /^\s*(_51DEGREES_(?:RESOURCE|LICENSE)_KEY[A-Z0-9_]*)\s*:\s*(.*?)\s*$/;
    const found = [];
    const wrong = [];

    for (const file of trackedFiles()) {
      if (!/^\.github\/workflows\/.*\.ya?ml$/.test(file)) {
        continue;
      }
      const lines = fs.readFileSync(path.join(REPOSITORY_ROOT, file), 'utf8')
        .split('\n');
      lines.forEach((line, index) => {
        const match = line.match(assignment);
        if (match) {
          const entry = `${file}:${index + 1}: ${match[1]}: ${match[2]}`;
          found.push(entry);
          if (match[2] !== '$' + '{{ secrets.' + match[1] + ' }}') {
            wrong.push(entry);
          }
        }
      });
    }

    // The Cloud 51Did workflow fills its keys, so the test cannot pass by
    // finding nothing.
    expect(found.length).toBeGreaterThan(0);
    expect(wrong).toEqual([]);
  });
});
