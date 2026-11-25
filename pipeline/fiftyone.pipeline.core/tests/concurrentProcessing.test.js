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

// One gate for each request. The doubler for request n waits until gate n
// opens, and the test opens the gates in the reverse of the order the
// requests started, so the finishing order does not depend on timers.
const gates = [];
for (let n = 0; n < REQUESTS; n++) {
  let open;
  gates.push({ promise: new Promise((resolve) => { open = resolve; }), open });
}

// The requests that have reached the doubler and are waiting at their gate.
let waiting = 0;

// Resolves once every request is waiting at its gate.
const allWaiting = () => waiting === REQUESTS
  ? Promise.resolve()
  : new Promise((resolve) => setImmediate(resolve)).then(allWaiting);

// Doubles query.n once the request's gate opens.
const doubler = new FlowElement({
  dataKey: 'doubler',
  evidenceKeyFilter: new BasicListEvidenceKeyFilter(['query.n']),
  processInternal: function (flowData) {
    const n = Number(flowData.evidence.get('query.n'));
    waiting++;
    return gates[n].promise.then(() => {
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { doubled: n * 2 }
      }));
    });
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
    // Every request is in the doubler before any finishes, so they overlap.
    await allWaiting();
    expect(finished).toEqual([]);
    for (let n = REQUESTS - 1; n >= 0; n--) {
      gates[n].open();
      await processing[n];
    }
    const results = await Promise.all(processing);

    expect(results.map((flowData) => [
      flowData.get('doubler').get('doubled'),
      flowData.get('adder').get('result')
    ])).toEqual(results.map((flowData, n) => [n * 2, n * 2 + 1]));
    expect(finished).toEqual(results.map((flowData, n) => REQUESTS - 1 - n));
  });
