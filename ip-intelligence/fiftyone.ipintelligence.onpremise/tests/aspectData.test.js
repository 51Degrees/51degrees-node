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

// The on-premise engine's Element Data extends Aspect Data, as
// ip-intelligence-specification/data-model.md lines 10 and 34 ask, and
// gives a Property by name as an AspectPropertyValue, as the cloud engine's
// does (cloud-aspect-engine.md line 24).

const fs = require('fs');
const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const { AspectPropertyValue } = require51('fiftyone.pipeline.core');
const { AspectData } = require51('fiftyone.pipeline.engines');
const Builder = require51('fiftyone.ipintelligence.onpremise')
  .IpIntelligenceOnPremisePipelineBuilder;

// The small ASN data file, which the other tests here use.
const ASN = path.join(__dirname, '..', '..', '..', 'cxx', 'data',
  'ip-intelligence', '51Degrees-IPIV4AsnIpiV41.ipi');
const IP_ADDRESS = '8.8.8.8';
const TIMEOUT_MS = 300000;

test('the on-premise Element Data is Aspect Data of AspectPropertyValues',
  async () => {
    if (!fs.existsSync(ASN)) {
      throw new Error(`No data file at '${ASN}'.`);
    }
    const pipeline = new Builder({
      dataFile: ASN,
      autoUpdate: false,
      fileSystemWatcher: false,
      shareUsage: false,
      licenceKeys: ''
    }).build();
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', IP_ADDRESS);
    await flowData.process();

    const ip = flowData.get('ip');
    expect(ip).toBeInstanceOf(AspectData);
    const values = Object.keys(ip.flowElement.properties)
      .map((name) => ip.get(name));
    expect(values.length).toBeGreaterThan(0);
    for (const value of values) {
      expect(value).toBeInstanceOf(AspectPropertyValue);
    }
    expect(values.some((value) => value.hasValue)).toBe(true);
  }, TIMEOUT_MS);
