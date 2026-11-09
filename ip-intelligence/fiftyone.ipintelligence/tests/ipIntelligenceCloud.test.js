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
    return require(requestedPackage);
  }
};

const IpIntelligencePipelineBuilder = require51('fiftyone.ipintelligence').IpIntelligencePipelineBuilder;
const keyUtils = require51('fiftyone.ipintelligence.shared').keyUtils;

const resourceKeyNames = keyUtils.resourceKeyNames(
  '51DEGREES_RESOURCE_KEY', 'RESOURCE_KEY');

describe('ipIntelligenceCloud', () => {
  // Process an IP address using the live cloud service and check that
  // the country property has a value. The test fails rather than skips
  // when no resource key is set.
  test('process IP address', async () => {
    const resourceKey = keyUtils.getResourceKey(resourceKeyNames);
    if (!resourceKey) {
      throw new Error(keyUtils.missingResourceKeyMessage(resourceKeyNames,
        'ip', 'the country of 8.8.8.8'));
    }
    const pipeline = new IpIntelligencePipelineBuilder({
      resourceKey
    }).build();
    pipeline.on('error', console.error);
    await keyUtils.requireProduct(pipeline.getElement('cloud'), 'ip');
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('query.client-ip', '8.8.8.8');

    await flowData.process();

    expect(flowData.ip.country.hasValue).toBe(true);
  });
});
