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

// The package takes the OWID library from its owid-js submodule and carries
// it in its own tarball, so installing it fetches nothing from GitHub.

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const PACKAGE = path.join(__dirname, '..');

// Starting npm takes several seconds on a Windows runner, which is longer
// than Jest's default of 5 seconds for a test.
const NPM_PACK_TIMEOUT_MS = 60000;

/**
 * Lists the files npm would put in the package's tarball.
 *
 * @returns {string[]} each file's path inside the package.
 */
function packedFiles () {
  const output = execSync('npm pack --dry-run --json --ignore-scripts', {
    cwd: PACKAGE,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore']
  });
  return JSON.parse(output)[0].files.map(file => file.path);
}

/**
 * Reads a manifest of the package.
 *
 * @param {string} name the file name.
 * @returns {object} the manifest.
 */
function manifest (name) {
  return JSON.parse(fs.readFileSync(path.join(PACKAGE, name), 'utf8'));
}

describe.each(['package.json', 'remote_package.json'])('%s', name => {
  test('names no dependency to fetch from GitHub', () => {
    const json = manifest(name);
    const dependencies = Object.assign({}, json.dependencies,
      json.optionalDependencies, json.peerDependencies);
    expect(Object.values(dependencies)
      .filter(spec => /github|git\+|^git:/i.test(spec))).toEqual([]);
    expect(json.bundleDependencies).toBeUndefined();
  });

  test('carries the OWID library and its licence, and no more of it', () => {
    const files = manifest(name).files;
    expect(files).toEqual(
      expect.arrayContaining(['owid-js/v1.js', 'owid-js/LICENSE']));
    expect(files.filter(file => file.startsWith('owid-js')))
      .toEqual(['owid-js/v1.js', 'owid-js/LICENSE']);
  });
});

test('both manifests pack the same files', () => {
  expect(manifest('remote_package.json').files)
    .toEqual(manifest('package.json').files);
});

test('npm packs the OWID library and its licence, and no more of it', () => {
  const files = packedFiles();
  expect(files.filter(file => file.startsWith('owid-js/')).sort())
    .toEqual(['owid-js/LICENSE', 'owid-js/v1.js']);
  // Every file at the top of the package is still packed.
  const topLevel = fs.readdirSync(PACKAGE)
    .filter(name => name.endsWith('.js'));
  expect(files).toEqual(expect.arrayContaining(topLevel));
  // This test reads remote_package.json, which only the repository has.
  expect(files).not.toContain('tests/packaging.test.js');
}, NPM_PACK_TIMEOUT_MS);

test('the 51Did reader uses the OWID library of the submodule', () => {
  const library = require('../owid-js/v1.js');
  expect(fs.existsSync(path.join(PACKAGE, 'owid-js', 'LICENSE'))).toBe(true);
  const { FodId } = require('../index');
  // Every OWID status passes through to the 51Did's own statuses.
  for (const [key, value] of Object.entries(library.ParseStatus)) {
    expect(FodId.ParseStatus[key]).toBe(value);
  }
});
