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

// Every Flow Element class in the repository's packages has a test that
// processes it and then writes to its Element Data, expecting the error, as
// the specification asks. The classes are found from the source, so a Flow
// Element added later fails this until a test names it here.

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../../..');

// The test that checks each class, by the path from the repository root.
const READ_ONLY_TESTS = {
  FlowElement: 'pipeline/fiftyone.pipeline.core/tests/finishedWrites.test.js',
  SequenceElement:
    'pipeline/fiftyone.pipeline.core/tests/readOnlyWebElements.test.js',
  JSONBundlerElement:
    'pipeline/fiftyone.pipeline.core/tests/readOnlyWebElements.test.js',
  JavaScriptBuilderElement:
    'pipeline/fiftyone.pipeline.core/tests/readOnlyWebElements.test.js',
  SetHeadersElement:
    'pipeline/fiftyone.pipeline.core/tests/readOnlyWebElements.test.js',
  Engine: 'pipeline/fiftyone.pipeline.engines/tests/readOnly.test.js',
  ShareUsage:
    'pipeline/fiftyone.pipeline.engines.fiftyone/tests/readOnly.test.js',
  CloudRequestEngine:
    'pipeline/fiftyone.pipeline.cloudrequestengine/tests/readOnly.test.js',
  CloudEngine:
    'pipeline/fiftyone.pipeline.cloudrequestengine/tests/readOnly.test.js',
  DerivedCloudEngine:
    'pipeline/fiftyone.pipeline.cloudrequestengine/tests/readOnly.test.js',
  TranslationEngine:
    'pipeline/fiftyone.pipeline.translation/tests/readOnly.test.js',
  DerivedPropertyElement:
    'pipeline/fiftyone.pipeline.derivedproperty/tests/readOnly.test.js',
  DeviceDetectionCloud:
    'device-detection/fiftyone.devicedetection.cloud/tests/readOnly.test.js',
  HardwareProfileCloudEngine:
    'device-detection/fiftyone.devicedetection.cloud/tests/readOnly.test.js',
  DeviceDetectionOnPremise:
    'device-detection/fiftyone.devicedetection.onpremise/tests/' +
    'readOnly.test.js',
  IpIntelligenceCloud:
    'ip-intelligence/fiftyone.ipintelligence.cloud/tests/readOnly.test.js',
  IpIntelligenceOnPremise:
    'ip-intelligence/fiftyone.ipintelligence.onpremise/tests/' +
    'readOnly.test.js',
  CountryCodeTranslationEngine:
    'ip-intelligence/fiftyone.ipintelligence.translation/tests/' +
    'readOnly.test.js',
  CountriesTranslationEngine:
    'ip-intelligence/fiftyone.ipintelligence.translation/tests/' +
    'readOnly.test.js',
  GeoLocationCloud: 'location/tests/readOnly.test.js'
};

// Folders that hold no package source.
const SKIPPED = new Set(['node_modules', 'tests', 'types', 'examples',
  'owid-js', 'derived-properties', 'javascript-templates', 'docs', 'cxx',
  'ci', '.git', '.github', 'build']);

const sourceFiles = (folder) => fs.readdirSync(folder, { withFileTypes: true })
  .flatMap((entry) => {
    const full = path.join(folder, entry.name);
    if (entry.isDirectory()) {
      return SKIPPED.has(entry.name) ? [] : sourceFiles(full);
    }
    return entry.name.endsWith('.js') ? [full] : [];
  });

// Every class that extends FlowElement, directly or through another.
const flowElementClasses = () => {
  const extensions = [];
  for (const folder of ['pipeline', 'device-detection', 'ip-intelligence',
    'location']) {
    for (const file of sourceFiles(path.join(ROOT, folder))) {
      const text = fs.readFileSync(file, 'utf8');
      for (const match of text.matchAll(
        /class\s+(\w+)\s+extends\s+([\w.]+)/g)) {
        extensions.push([match[1], match[2].split('.').pop()]);
      }
    }
  }
  const found = new Set(['FlowElement']);
  let added = true;
  while (added) {
    added = false;
    for (const [name, base] of extensions) {
      if (found.has(base) && !found.has(name)) {
        found.add(name);
        added = true;
      }
    }
  }
  return [...found].sort();
};

test('every Flow Element has a test that its Element Data is read only ' +
  'once processed', () => {
  const classes = flowElementClasses();
  expect(classes.length).toBeGreaterThan(10);
  const missing = classes.filter((name) => {
    const file = READ_ONLY_TESTS[name];
    return file === undefined ||
      !fs.existsSync(path.join(ROOT, file)) ||
      !fs.readFileSync(path.join(ROOT, file), 'utf8').includes(name);
  });
  expect(missing).toEqual([]);
});
