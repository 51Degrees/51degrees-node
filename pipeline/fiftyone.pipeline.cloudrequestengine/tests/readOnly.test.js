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

// The Element Data of the CloudRequestEngine, of a CloudEngine and of the
// DerivedCloudEngine is read only once each has finished.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const CloudEngine = require('../cloudEngine');
const DerivedCloudEngine = require('../derivedCloudEngine');
const MockRequestClient = require('./classes/mockRequestClient');

test('the cloud engines\' Element Data is read only once processed',
  async () => {
    const device = new CloudEngine();
    device.dataKey = 'device';
    const flowData = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(new CloudRequestEngine({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: new MockRequestClient()
      }))
      .add(device)
      .build().createFlowData();
    await flowData.process();
    expect(() => { flowData.cloud.probe = 1; })
      .toThrow('has finished processing');
    expect(() => { flowData.device.probe = 1; })
      .toThrow('has finished processing');
  });

// The DerivedCloudEngine gives its own Element Data where a call that
// carried a sealed Human Confidence result failed. That data is read only
// once processed too.
test('the DerivedCloudEngine Element Data is read only once processed, ' +
  'also where it gives Medium for a failed call', async () => {
  const flowData = new PipelineBuilder({ addJavaScriptBuilder: false })
    .add(new CloudRequestEngine({
      resourceKey: 'AAAAAAAAAAAA',
      licenseKey: 'BBBBBBBBBBBB',
      requestClient: new MockRequestClient({ error: new Error('down') })
    }))
    .add(new DerivedCloudEngine())
    .build().createFlowData();
  flowData.evidence.add('query.humanconfidence', 'sealed');
  await flowData.process().catch(() => undefined);
  expect(flowData.derived.humanconfidence.value).toBe('Medium');
  expect(() => { flowData.derived.probe = 1; })
    .toThrow('has finished processing');
});
