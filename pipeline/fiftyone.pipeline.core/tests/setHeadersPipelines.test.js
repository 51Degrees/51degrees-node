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

// One Set Headers element can be added to several Pipelines whose elements
// differ, so it keeps the headers each Pipeline's elements can set for that
// Pipeline (multi-pipeline-elements.md line 17).

const core = require('fiftyone.pipeline.core');

// An element whose one SetHeader Property gives the value.
const setting = (dataKey, propertyName, value) => new core.FlowElement({
  dataKey,
  properties: { [propertyName.toLowerCase()]: { name: propertyName } },
  processInternal: function (flowData) {
    flowData.setElementData(new core.ElementDataDictionary({
      flowElement: this,
      contents: {
        [propertyName.toLowerCase()]: new core.AspectPropertyValue(null, value)
      }
    }));
  }
});

// The response headers a Pipeline's Set Headers element gives.
const headersFrom = async (pipeline) => {
  const flowData = pipeline.createFlowData();
  await flowData.process();
  return flowData['set-headers'].get('responseheadersdictionary');
};

describe('One Set Headers element in two Pipelines', () => {
  const setHeaders = new core.SetHeadersElement();
  const first = new core.PipelineBuilder()
    .add(setting('browser', 'SetHeaderBrowserAccept-CH', 'SEC-CH-UA'))
    .add(setHeaders)
    .build();
  const second = new core.PipelineBuilder()
    .add(setting('hardware', 'SetHeaderHardwareCritical-CH',
      'SEC-CH-UA-Model'))
    .add(setHeaders)
    .build();

  test('gives each Pipeline the headers its own elements set', async () => {
    expect(await headersFrom(first)).toEqual({ 'Accept-CH': 'SEC-CH-UA' });
    expect(await headersFrom(second))
      .toEqual({ 'Critical-CH': 'SEC-CH-UA-Model' });
    expect(await headersFrom(first)).toEqual({ 'Accept-CH': 'SEC-CH-UA' });
  });
});
