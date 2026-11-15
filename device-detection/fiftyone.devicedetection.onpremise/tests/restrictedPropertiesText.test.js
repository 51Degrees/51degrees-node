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

// A configuration file gives a list of strings as one comma separated
// string (pipeline-configuration.md lines 50 to 62), so an engine built from
// a configuration may be given its restricted properties that way, and has
// the same properties as one given them as a list in code. Checked with the
// native engine and the free data file.

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const core = require51('fiftyone.pipeline.core');
const Engine = require51('fiftyone.devicedetection.onpremise')
  .DeviceDetectionOnPremise;
const testHelper = require('./testHelper');

const dataFilePath = testHelper.getDataFilePath(testHelper.liteDataFileName);
const NAMES = ['IsMobile', 'BrowserName'];
const TIMEOUT_MS = 120000;

// Settings that need no licence key, download or watcher.
const settings = {
  dataFilePath,
  licenceKeys: '',
  autoUpdate: false,
  fileSystemWatcher: false
};

describe('restricted properties of an engine built from a configuration', () => {
  test('given as one comma separated string are those properties', () => {
    const pipeline = new core.PipelineBuilder().buildFromConfiguration({
      PipelineOptions: {
        Elements: [{
          elementName:
            'fiftyone.devicedetection.onpremise/deviceDetectionOnPremise',
          elementParameters: {
            ...settings,
            restrictedProperties: NAMES.join(', ')
          }
        }]
      }
    });
    const fromText = pipeline.flowElements.device;
    const fromList = new Engine({ ...settings, restrictedProperties: NAMES });
    const everything = new Engine(settings);

    const keys = (engine) => Object.keys(engine.properties).sort();
    expect(keys(fromText)).toEqual(keys(fromList));
    expect(keys(fromText)).toEqual(
      expect.arrayContaining(['ismobile', 'browsername']));
    expect(keys(fromText).length).toBeLessThan(keys(everything).length);
  }, TIMEOUT_MS);
});
