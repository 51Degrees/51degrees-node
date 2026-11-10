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

// Guards the package layout. The shipped code must sit outside the
// examples and tests folders, because the release plan ignores both.
// Those folders hold only re-exports of lib, so that a require
// of an old path keeps working.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const packageRoot = path.join(__dirname, '..');
const exported = [
  'testConstants',
  'keyUtils', 'exampleOutput', 'exampleConstants',
  'optionsExtension', 'dataExtension'
];

// The paths the package published before its modules moved to lib. Each is a
// file that re-exports the module in lib.
const oldPaths = [
  'examples/dataExtension.js',
  'examples/exampleConstants.js',
  'examples/optionsExtension.js',
  'tests/exampleOutput.js',
  'tests/keyUtils.js',
  'tests/testConstants.js'
];

describe('shared package layout', () => {
  test('index exports every module', () => {
    const shared = require(packageRoot);
    exported.forEach((name) => {
      expect(shared[name]).toBeDefined();
    });
    expect(typeof shared.dataExtension.getValueHelper).toBe('function');
    expect(typeof shared.optionsExtension).toBe('function');
    expect(shared.errorMessages).toBeDefined();
  });

  test('index requires nothing from examples or tests folders', () => {
    const source = fs.readFileSync(
      path.join(packageRoot, 'index.js'), 'utf8');
    const required = [...source.matchAll(/require\('([^']+)'\)/g)]
      .map((match) => match[1]);
    expect(required.length).toBeGreaterThan(0);
    required.forEach((target) => {
      expect(target).not.toMatch(/(^|\/)(examples|tests)(\/|$)/);
    });
  });

  test('the packed files include lib and the old paths',
    () => {
      const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const output = execFileSync(
        npm, ['pack', '--dry-run', '--json', '--ignore-scripts'],
        {
          cwd: packageRoot,
          encoding: 'utf8',
          shell: process.platform === 'win32'
        });
      const packed = JSON.parse(output)[0].files.map((f) => f.path);
      expect(packed).toContain('index.js');
      exported.forEach((name) => {
        expect(packed).toContain('lib/' + name + '.js');
      });
      packed.filter((file) => /^(examples|tests)\//.test(file))
        .forEach((file) => {
          expect(oldPaths).toContain(file);
        });
      oldPaths.forEach((file) => {
        expect(packed).toContain(file);
      });
    });

  test('each old path still resolves to the module in lib', () => {
        oldPaths.forEach((file) => {
      const name = path.basename(file, '.js');
      expect(require(path.join(packageRoot, file)))
        .toBe(require(path.join(packageRoot, 'lib', name)));
    });
  });

  test('each old path re-exports the module in lib', () => {
    oldPaths.forEach((file) => {
      const source = fs.readFileSync(path.join(packageRoot, file), 'utf8');
      expect(source).toMatch(
        /module\.exports = require\('\.\.\/lib\/\w+'\);/);
    });
  });
});
