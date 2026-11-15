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

// With minify on, the JavaScript Builder gives its script minified
// (javascript-builder.md lines 105 and 106), so it is shorter than the
// script with minify off and is still JavaScript that parses.

const vm = require('vm');
const PipelineBuilder = require('../pipelineBuilder');

/**
 * The script the JavaScript Builder gives for one Flow Data.
 *
 * @param {boolean} minify whether to minify the script
 * @returns {Promise<string>} the script
 */
const scriptFor = async (minify) => {
  const pipeline = new PipelineBuilder({
    javascriptBuilderSettings: { minify }
  }).build();
  const flowData = pipeline.createFlowData();
  await flowData.process();
  return flowData.get('javascriptbuilder').get('javascript');
};

test('the JavaScript Builder minifies its script when minify is on',
  async () => {
    const plain = await scriptFor(false);
    const minified = await scriptFor(true);

    expect(minified.length).toBeLessThan(plain.length);
    expect(() => new vm.Script(minified)).not.toThrow();
  });
