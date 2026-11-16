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

// The IP Intelligence data model gives the area an address points to as
// Areas, a WKT shape of one or more polygons, and gives AccuracyRadius as a
// property of its own (data-model.md lines 50 and 51). So no example
// describes that area as a circle or writes a distance worked out from it,
// because the data gives neither, and an example that shows
// AccuracyRadiusMin names that property rather than a shorter name that
// reads as a different one.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FOLDERS = ['device-detection', 'ip-intelligence', 'location', 'pipeline'];

// Folders that hold no example of ours: installed packages, the scripts a
// page loads and the JavaScript templates submodule.
const SKIPPED_FOLDERS = ['node_modules', 'public', 'javascript-templates'];

// Every example file, which is every .js, .ts, .pug and .html file below an
// examples folder other than a test.
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
      } else if (inExamples && /\.(js|ts|pug|html)$/.test(entry.name) &&
        !/\.test\.(js|ts)$/.test(entry.name)) {
        found.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  }
  return found.sort();
};

const text = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8');

const files = exampleFiles();

// The files that show AccuracyRadiusMin, whatever the letter case of the
// name they read it by.
const showingAccuracyRadiusMin = files
  .filter((file) => /accuracyradiusmin/i.test(text(file)));

// The files about where an IP address points, being every example of the
// IP Intelligence and location packages and any other that reads Areas or
// an accuracy radius. AccuracyRadiusMin and AccuracyRadiusMax are distances
// from the point returned to the nearest and the furthest edge of the area,
// so neither is a circle drawn from the point. Other examples may say
// circle.
const aboutIpLocation = files.filter((file) =>
  /^(ip-intelligence|location)\//.test(file) ||
  /\bareas\b|accuracyradius/i.test(text(file)));

describe('how the examples describe an area', () => {
  test('the examples are found', () => {
    expect(files.length).toBeGreaterThan(0);
    expect(showingAccuracyRadiusMin.length).toBeGreaterThan(0);
    expect(aboutIpLocation.length).toBeGreaterThan(0);
    expect(aboutIpLocation.length).toBeLessThan(files.length);
  });

  describe.each(aboutIpLocation)('%s', (file) => {
    test('does not call an area a circle', () => {
      expect(text(file)).not.toMatch(/circle/i);
    });
  });

  describe.each(files)('%s', (file) => {
    test('writes no distance worked out from an area', () => {
      expect(text(file)).not.toMatch(/equivalent\s*radius/i);
    });
  });

  describe.each(showingAccuracyRadiusMin)('%s', (file) => {
    test('names AccuracyRadiusMin in full', () => {
      expect(text(file)).not.toMatch(/Accuracy Radius(?! Min)/);
    });
  });
});
