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
// native engine and the free ASN data file.

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const core = require51('fiftyone.pipeline.core');
const Engine = require51('fiftyone.ipintelligence.onpremise')
  .IpIntelligenceOnPremise;

const dataFilePath = path.resolve(__dirname, '..', '..', '..', 'cxx', 'data',
  'ip-intelligence', '51Degrees-IPIV4AsnIpiV41.ipi');
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
    const everything = new Engine(settings);
    const keys = (engine) => Object.keys(engine.properties).sort();
    // The first property the data file has, in its own spelling, so the
    // restricted engine has fewer properties than one with every property.
    const names = [Object.values(everything.properties)[0].name];
    expect(keys(everything).length).toBeGreaterThan(names.length);

    const pipeline = new core.PipelineBuilder().buildFromConfiguration({
      PipelineOptions: {
        Elements: [{
          elementName:
            'fiftyone.ipintelligence.onpremise/ipIntelligenceOnPremise',
          elementParameters: {
            ...settings,
            restrictedProperties: names.join(', ') + ','
          }
        }]
      }
    });
    const fromText = pipeline.flowElements.ip;
    const fromList = new Engine({ ...settings, restrictedProperties: names });

    expect(keys(fromText)).toEqual(keys(fromList));
    expect(keys(fromText)).toEqual(names.map((name) => name.toLowerCase()));
  }, TIMEOUT_MS);
});
