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

// Every pipeline builder that adds a Cloud Request Engine passes the
// license key and the requested properties to it, so a caller with a
// license key and no resource key can build a cloud pipeline.

const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');
const load = (file) => require(path.join(root, file));

const licenseKey = 'LICENSEKEY1234567890';
const requestedProperties = ['device.ismobile', 'location.country'];

const builders = [
  ['Device Detection', load(
    'device-detection/fiftyone.devicedetection/deviceDetectionPipelineBuilder')],
  ['Device Detection cloud', load(
    'device-detection/fiftyone.devicedetection.cloud/' +
    'deviceDetectionCloudPipelineBuilder')],
  ['IP Intelligence', load(
    'ip-intelligence/fiftyone.ipintelligence/ipIntelligencePipelineBuilder')],
  ['IP Intelligence cloud', load(
    'ip-intelligence/fiftyone.ipintelligence.cloud/' +
    'ipIntelligenceCloudPipelineBuilder')],
  ['location', load('location/geoLocationPipelineBuilder')]
];

describe.each(builders)('the %s pipeline builder', (name, Builder) => {
  test('passes the license key and the requested properties', () => {
    const pipeline = new Builder({
      licenceKeys: licenseKey,
      requestedProperties,
      shareUsage: false
    }).build();
    const cloud = pipeline.flowElements.cloud;

    expect(cloud.resourceKey).toBe('');
    expect(cloud.licenseKey).toBe(licenseKey);
    expect(cloud.requestedProperties).toEqual(requestedProperties);
  });
});
