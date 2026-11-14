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

// IP Intelligence web examples share usage, as the Device Detection web
// examples do, where the console examples do not
// (ip-intelligence-specification/required-examples.md lines 239 to 241).

const path = require('path');

const example = require(path.join(__dirname, 'gettingStarted.js'));

// The free ASN data file, which is small and has what the page needs to
// build its Pipeline.
const ASN = path.resolve(__dirname, '..', '..', '..', '..', '..', 'cxx',
  'data', 'ip-intelligence', '51Degrees-IPIV4AsnIpiV41.ipi');
const TIMEOUT_MS = 120000;

describe('IP Intelligence getting started web page', () => {
  test('shares usage', () => {
    const pipeline = example.setPipeline({
      PipelineOptions: {
        Elements: [{
          elementName:
            'fiftyone.ipintelligence.onpremise/ipIntelligenceOnPremise',
          elementParameters: { dataFilePath: ASN }
        }]
      }
    });

    expect(Object.keys(pipeline.flowElements)).toContain('shareUsage');
  }, TIMEOUT_MS);
});
