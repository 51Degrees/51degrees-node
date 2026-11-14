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

// Every 51d.json an example builds its Pipeline from names each element by
// its package, so the same file works in this repository and with the
// published packages. The core package's PipelineBuilder requires each name,
// so each must resolve from there.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CORE = path.join(ROOT, 'pipeline', 'fiftyone.pipeline.core');
const FOLDERS = ['device-detection', 'ip-intelligence', 'location', 'pipeline'];

// Every 51d.json under the folders, leaving out installed packages.
const configurations = () => {
  const found = [];
  const pending = FOLDERS.map((folder) => path.join(ROOT, folder));
  while (pending.length > 0) {
    const dir = pending.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules') {
          pending.push(full);
        }
      } else if (entry.name === '51d.json') {
        found.push(full);
      }
    }
  }
  return found.sort();
};

// Each configuration file with the element names it holds.
const elements = configurations().flatMap((file) =>
  JSON.parse(fs.readFileSync(file, 'utf8')).PipelineOptions.Elements
    .map((element) => [
      path.relative(ROOT, file).split(path.sep).join('/'),
      element.elementName
    ]));

describe('example configuration files', () => {
  it('are found', () => {
    expect(elements.length).toBeGreaterThan(0);
  });

  it.each(elements)('%s names %s by its package', (file, name) => {
    expect(name.startsWith('.')).toBe(false);
    expect(() => require.resolve(name, { paths: [CORE] })).not.toThrow();
  });
});
