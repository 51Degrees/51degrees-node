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

// The builder puts the usage sharing element after every other Flow
// Element, the web elements it adds included, and after one the caller adds
// after making the builder. The cloud service is not asked, as the test
// needs only the Pipeline.

const path = require('path');

const { GeoLocationPipelineBuilder } = require(path.resolve(__dirname, '..'));
const { FlowElement } = require('fiftyone.pipeline.core');
const { ShareUsage } = require('fiftyone.pipeline.engines.fiftyone');
const RequestClient = require(
  'fiftyone.pipeline.cloudrequestengine/requestClient');

test('GeoLocationPipelineBuilder puts usage sharing last, after an element ' +
  'the caller adds later', () => {
  const get = jest.spyOn(RequestClient.prototype, 'get')
    .mockReturnValue(new Promise(() => {}));
  try {
    const pipeline = new GeoLocationPipelineBuilder({
      resourceKey: 'AAAAAAAAAAAA'
    }).add(new FlowElement({ dataKey: 'later' })).build();
    const chain = pipeline.flowElementsChain;
    expect(chain[chain.length - 1]).toBeInstanceOf(ShareUsage);
    expect(chain.flat().filter((slot) => slot instanceof ShareUsage))
      .toHaveLength(1);
  } finally {
    get.mockRestore();
  }
});
