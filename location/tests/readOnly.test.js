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

// The Element Data of GeoLocationCloud is read only once it has finished.

const path = require('path');
const { PipelineBuilder } = require('fiftyone.pipeline.core');
const { CloudRequestEngine } =
  require('fiftyone.pipeline.cloudrequestengine');
const MockRequestClient = require(path.resolve(__dirname,
  '../../pipeline/fiftyone.pipeline.cloudrequestengine/tests/classes/' +
  'mockRequestClient'));
const GeoLocationCloud = require('../geoLocationCloud');

test('GeoLocationCloud Element Data is read only once processed',
  async () => {
    const flowData = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(new CloudRequestEngine({
        resourceKey: 'AAAAAAAAAAAA',
        requestClient: new MockRequestClient()
      }))
      .add(new GeoLocationCloud({ locationProvider: 'fiftyonedegrees' }))
      .build().createFlowData();
    await flowData.process();
    expect(() => { flowData.location.probe = 1; })
      .toThrow('has finished processing');
  });
