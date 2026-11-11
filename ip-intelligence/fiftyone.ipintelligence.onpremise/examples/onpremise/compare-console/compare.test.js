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

const fs = require('fs');
const os = require('os');
const path = require('path');
const {
  getTestDataFile, dataFileDirectories
} = require(path.join(__dirname, '/../../../tests/testHelper'));

const example = require(path.join(__dirname, '/compare.js'));

const GEOIP_COMPARISON_EVIDENCE_FILE = 'geoip_comparison_evidence.csv';

const getEvidenceFilePath = function () {
  for (const fileDir of dataFileDirectories) {
    const fullPath = path.join(fileDir, GEOIP_COMPARISON_EVIDENCE_FILE);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }
  throw (`No evidence file '${GEOIP_COMPARISON_EVIDENCE_FILE}' found at
    '${dataFileDirectories.join(', ')}'!`);
};

describe('Examples', () => {
  test('onpremise compare', async () => {
    const outputFile = path.join(os.tmpdir(), 'compare-output.csv');
    const output = fs.createWriteStream(outputFile);
    try {
      // CI holds the whole file in memory, and LowMemory is about 3x slower.
      await example.run(
        getTestDataFile(),
        getEvidenceFilePath(),
        output,
        process.stdout,
        'MaxPerformance');
    } finally {
      output.end();
      fs.rmSync(outputFile, { force: true });
    }
    expect(true);
  }, 120000);
});
