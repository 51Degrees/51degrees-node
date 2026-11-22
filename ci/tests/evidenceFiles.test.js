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

// Evidence is read from YAML files: the performance examples, the names the
// shared packages give, and the files the CI scripts fetch and pass. The
// source is read rather than run, so no data file is needed.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');

const read = (...parts) => fs.readFileSync(path.join(ROOT, ...parts), 'utf8');

// The evidence file each performance example reads by default.
const PERFORMANCE_EXAMPLES = [
  [
    path.join('device-detection', 'fiftyone.devicedetection.onpremise',
      'examples', 'onpremise', 'performance-console', 'performance.js'),
    '20000 Evidence Records.yml'
  ],
  [
    path.join('ip-intelligence', 'fiftyone.ipintelligence.onpremise',
      'examples', 'onpremise', 'performance-console', 'performance.js'),
    'evidence.yml'
  ]
];

// The only CSV file the CI scripts name, which lists property names for
// the cloud tests and holds no evidence.
const PROPERTIES_CSV = '51Degrees.csv';

describe('evidence files', () => {
  for (const [file, evidence] of PERFORMANCE_EXAMPLES) {
    test(`${file} reads ${evidence}`, () => {
      const source = read(file);
      expect(source).toContain(`'${evidence}'`);
      expect(source).toContain("require('js-yaml')");
      expect(source).not.toMatch(/\.csv\b/);
    });
  }

  test('the shared packages name only YAML evidence files', () => {
    const names = [
      require(path.join(ROOT, 'device-detection',
        'fiftyone.devicedetection.shared')).exampleConstants.fileNames,
      require(path.join(ROOT, 'ip-intelligence',
        'fiftyone.ipintelligence.shared')).exampleConstants.fileNames
    ];
    expect(names).toEqual([
      {
        enterpriseDataFileName: 'Enterprise-HashV41.hash',
        liteDataFileName: '51Degrees-LiteV4.1.hash',
        evidenceFileName: '20000 Evidence Records.yml'
      },
      {
        enterpriseDataFileName: names[1].enterpriseDataFileName,
        liteDataFileName: '51Degrees-LiteV41.ipi',
        evidenceFileName: 'evidence.yml'
      }
    ]);
  });

  test('the CI scripts fetch and pass no CSV evidence', () => {
    for (const script of ['fetch-assets.ps1', 'run-performance-tests.ps1']) {
      const source = read('ci', script);
      const csv = [...source.matchAll(/[A-Za-z0-9_. -]*\.csv\b/g)]
        .map((match) => match[0].trim())
        .filter((name) => name !== PROPERTIES_CSV);
      expect({ script, csv }).toEqual({ script, csv: [] });
      expect(source).not.toMatch(/-csv\b/);
    }
  });
});
