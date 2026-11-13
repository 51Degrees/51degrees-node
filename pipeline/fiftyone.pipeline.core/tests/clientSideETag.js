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

// Starts a server with the JavaScript endpoint, asks it for the script with
// the User-Agent given, and prints the ETag it answered with, so that a test
// can compare the ETag two processes give for the same evidence.
//   node clientSideETag.js <User-Agent>

const http = require('http');
const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');
const Helpers = require('../helpers');

const element = new FlowElement({
  dataKey: 'test',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: { useragent: flowData.evidence.get('header.user-agent') }
    }));
  }
});
const pipeline = new PipelineBuilder({
  useSetHeaderProperties: false,
  javascriptBuilderSettings: { endPoint: '/json' }
}).add(element).build();
pipeline.on('error', () => {});

const server = http.createServer(async (req, res) => {
  // A fault answers 500 with its message, so the test fails on it rather
  // than waiting for a response that never comes.
  try {
    const flowData = pipeline.createFlowData();
    await flowData.evidence.addFromRequestAsync(req);
    await flowData.process();
    Helpers.writeClientSideResponse(req, res, flowData,
      'application/x-javascript', flowData.javascriptbuilder.javascript);
  } catch (e) {
    res.statusCode = 500;
    res.end(String(e));
  }
});

server.listen(0, '127.0.0.1', () => {
  http.get({
    host: '127.0.0.1',
    port: server.address().port,
    path: '/51Degrees.core.js',
    agent: false,
    headers: { Host: 'example.test', 'User-Agent': process.argv[2] }
  }, (res) => {
    res.resume();
    res.on('end', () => {
      process.stdout.write(res.headers.etag + '\n');
      server.close();
    });
  });
});
