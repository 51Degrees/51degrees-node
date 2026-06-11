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

const path = require('path');
const fs = require('fs');

const request = require('supertest');

const {
  dataFileDirectories
} = require(path.join(__dirname, '/../../../../tests/testHelper'));

// Load the example module
const example = require(path.join(__dirname, '/gettingStarted.js'));

// The mixed examples also need a device detection data file which is not
// included in this repository. The test is skipped where one cannot be
// found.
const HASH_FILE_NAMES = [
  'TAC-HashV41.hash',
  '51Degrees-EnterpriseV4.1.hash',
  '51Degrees-LiteV4.1.hash'
];

let deviceDataFile;
for (const fileName of HASH_FILE_NAMES) {
  for (const fileDir of dataFileDirectories) {
    const fullPath = path.join(fileDir, fileName);
    if (fs.existsSync(fullPath)) {
      deviceDataFile = fullPath;
      break;
    }
  }
  if (deviceDataFile !== undefined) break;
}

describe('Examples', () => {
  const testFunc = deviceDataFile ? test : test.skip;
  testFunc('onpremise mixed getting started web', async () => {
    // Load configuration options
    const options = JSON.parse(fs.readFileSync(path.join(__dirname, '/51d.json')));

    // Update the device detection data file path with the found file
    options.PipelineOptions.Elements[0].elementParameters.dataFilePath =
      deviceDataFile;

    // Update the IP intelligence data file path with a full path
    const ipParameters =
      options.PipelineOptions.Elements[1].elementParameters;
    if (ipParameters.dataFilePath.startsWith('.')) {
      ipParameters.dataFilePath =
        path.join(__dirname, '/', ipParameters.dataFilePath);
    }

    // Update element path with a full path
    for (const element of options.PipelineOptions.Elements) {
      if (element.elementName.startsWith('.')) {
        element.elementName = path.join(__dirname, '/', element.elementName);
      }
    }

    example.setPipeline(options);
    const response = await request(example.server)
      .get('/?client-ip=8.8.8.8');
    expect(response.statusCode).toBe(200);
  }, 60000);
});
