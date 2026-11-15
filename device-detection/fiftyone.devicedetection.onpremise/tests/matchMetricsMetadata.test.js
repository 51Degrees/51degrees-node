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

// The Engine lists the match metric Properties after the Properties from the
// data file, in the order of the specification's table, each with the
// category "Device Metrics", every data file, the Metrics component and its
// default value (device-detection-on-premise.md lines 448 to 475).

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const Engine = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremise;

const LITE = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'device-detection', '51Degrees-LiteV4.1.hash');

// The table, in its order: name, type and default value.
const METRICS = [
  ['MatchedNodes', 'int', 0],
  ['Difference', 'int', 0],
  ['Drift', 'int', 0],
  ['DeviceId', 'string', '0-0-0-0'],
  ['UserAgents', 'string[]', []],
  ['Iterations', 'int', 0],
  ['Method', 'string', 'NONE']
];

// The data files every match metric Property is available with.
const DATA_FILES = ['Lite', 'Premium', 'Enterprise', 'TAC'];

describe('match metric Properties', () => {
  let engine;

  beforeAll(() => {
    if (!fs.existsSync(LITE)) {
      throw new Error(`No data file at '${LITE}'.`);
    }
    engine = new Engine({
      dataFilePath: LITE,
      autoUpdate: false,
      fileSystemWatcher: false,
      licenceKeys: ''
    });
  });

  test('come after the data file Properties, in the order of the table',
    () => {
      const names = Object.values(engine.properties).map((p) => p.name);
      expect(names.slice(-METRICS.length))
        .toEqual(METRICS.map(([name]) => name));
    });

  test.each(METRICS)('%s has the metadata of the table',
    (name, type, defaultValue) => {
      const property = Object.values(engine.properties)
        .find((p) => p.name === name);
      expect({
        type: property.type,
        category: property.category,
        dataFiles: property.dataFiles,
        component: property.component.name,
        defaultValue: property.defaultValue
      }).toEqual({
        type,
        category: 'Device Metrics',
        dataFiles: DATA_FILES,
        component: 'Metrics',
        defaultValue
      });
    });

  test('the Metrics component is one of the Engine\'s components', () => {
    expect(engine.components.metrics.name).toBe('Metrics');
  });
});
