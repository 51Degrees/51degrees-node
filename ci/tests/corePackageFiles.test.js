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

// The core package carries the one template its JavaScript Builder reads,
// and not the rest of the javascript-templates submodule, so the submodule
// can move on without changing what the package holds. These tests read
// what npm would pack, without packing it.

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

const CORE = path.join(__dirname, '..', '..', 'pipeline',
  'fiftyone.pipeline.core');
const TEMPLATES = 'javascript-templates/';
const TEMPLATE = TEMPLATES + 'JavaScriptResource.mustache';

// The paths npm would pack for the core package. On Windows npm is a
// command script, which only a shell can start.
const packedFiles = () => {
  const result = childProcess.spawnSync(
    'npm', ['pack', '--dry-run', '--json'], {
      cwd: CORE,
      encoding: 'utf8',
      shell: process.platform === 'win32'
    });
  expect({ status: result.status, stderr: result.stderr })
    .toEqual({ status: 0, stderr: expect.any(String) });
  return JSON.parse(result.stdout)[0].files
    .map((file) => file.path.split(path.sep).join('/'));
};

describe('the core package', () => {
  let files;

  beforeAll(() => {
    files = packedFiles();
  }, 120000);

  it('packs the template the JavaScript Builder reads', () => {
    expect(fs.existsSync(path.join(CORE, TEMPLATE))).toBe(true);
    expect(files).toContain(TEMPLATE);
  });

  it('packs nothing else from the javascript-templates submodule', () => {
    expect(files.filter((file) => file.startsWith(TEMPLATES)))
      .toEqual([TEMPLATE]);
  });

  it('packs every module and its types', () => {
    const modules = fs.readdirSync(CORE)
      .filter((name) => name.endsWith('.js'));
    expect(modules).toContain('index.js');
    for (const name of modules) {
      expect(files).toContain(name);
    }
    expect(files).toContain('types/index.d.ts');
  });
});
