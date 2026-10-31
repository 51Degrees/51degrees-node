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
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(path.join(__dirname, '/../../', requestedPackage));
  }
};

const IpIntelligencePipelineBuilder = require51('fiftyone.ipintelligence').IpIntelligencePipelineBuilder;
const myResourceKey = process.env.RESOURCE_KEY;

describe('ipIntelligenceCloud', () => {
  // Process an IP address using the cloud service and check that
  // a value is returned for the country property.
  // This test requires a resource key with the country property
  // to be provided via the RESOURCE_KEY environment variable.
  const testFunc = myResourceKey ? test : test.skip;
  testFunc('process IP address', done => {
    const pipeline = new IpIntelligencePipelineBuilder({
      resourceKey: myResourceKey
    }).build();
    pipeline.on('error', console.error);
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', '8.8.8.8');

    flowData.process().then(function () {
      const country = flowData.ip.country;
      expect(country).toBeDefined();

      done();
    });
  });
});
