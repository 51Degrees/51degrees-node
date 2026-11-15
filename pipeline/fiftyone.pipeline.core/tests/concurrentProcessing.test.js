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

// One Pipeline processes many Flow Data at once, and each keeps its own
// results (thread-safety.md lines 8 and 9).

const PipelineBuilder = require('../pipelineBuilder');
const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');

const REQUESTS = 20;

// How much longer each request waits than the one started after it, so the
// requests overlap and finish in the reverse of the order they started.
const STEP_MS = 5;

// Doubles query.n after a wait that is longer the smaller n is.
const doubler = new FlowElement({
  dataKey: 'doubler',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter(['query.n']),
  processInternal: function (flowData) {
    const n = Number(flowData.evidence.get('query.n'));
    return new Promise((resolve) => setTimeout(() => {
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { doubled: n * 2 }
      }));
      resolve();
    }, (REQUESTS - n) * STEP_MS));
  },
  properties: { doubled: { type: 'int' } }
});

// Adds one to the doubler's answer for the same Flow Data.
const adder = new FlowElement({
  dataKey: 'adder',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter([]),
  processInternal: function (flowData) {
    flowData.setElementData(new ElementDataDictionary({
      flowElement: this,
      contents: { result: flowData.get('doubler').get('doubled') + 1 }
    }));
  },
  properties: { result: { type: 'int' } }
});

test('one Pipeline processes many Flow Data at once, each with its own results',
  async () => {
    const pipeline = new PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false
    }).add(doubler).add(adder).build();
    const finished = [];
    const processing = [];

    for (let n = 0; n < REQUESTS; n++) {
      const flowData = pipeline.createFlowData();
      flowData.evidence.add('query.n', String(n));
      processing.push(flowData.process().then((done) => {
        finished.push(n);
        return done;
      }));
    }
    const results = await Promise.all(processing);

    expect(results.map((flowData) => [
      flowData.get('doubler').get('doubled'),
      flowData.get('adder').get('result')
    ])).toEqual(results.map((flowData, n) => [n * 2, n * 2 + 1]));
    expect(finished).toEqual(results.map((flowData, n) => REQUESTS - 1 - n));
  });
