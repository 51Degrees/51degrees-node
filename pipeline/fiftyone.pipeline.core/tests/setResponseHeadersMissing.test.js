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

// The web integration does not stop the site when a request's processing
// went wrong (exception-handling.md lines 67 to 75), so setting the response
// headers from a Flow Data with no Set Headers result sets none and logs a
// warning.

const httpMocks = require('node-mocks-http');
const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');
const Helpers = require('../helpers');

// Stops processing, so the elements after it, the Set Headers element among
// them, give no result.
const stopper = new FlowElement({
  dataKey: 'stopper',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter([]),
  processInternal: function (flowData) {
    flowData.stop();
  }
});

test('response headers from a Flow Data with no Set Headers result',
  async () => {
    const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
      .add(stopper).build();
    const warnings = [];
    pipeline.on('warn', (message) => warnings.push(String(message)));
    const flowData = pipeline.createFlowData();
    await flowData.process();
    const response = httpMocks.createResponse();

    expect(() => Helpers.setResponseHeaders(response, flowData))
      .not.toThrow();
    expect(Object.keys(response.getHeaders())).toEqual([]);
    expect(warnings.join('\n')).toContain('Set Headers');
  });
