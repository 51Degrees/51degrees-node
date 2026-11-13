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

// A detection checks each piece of evidence against an engine's key filter
// as the evidence is added, and again as the engine reads the evidence it
// accepts. These tests count how often a BasicListEvidenceKeyFilter puts the
// keys in its list in lower case, and fail if it does that on every check
// rather than once, which costs every detection the length of the list.

const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');
const FlowElement = require('../flowElement');
const ElementDataDictionary = require('../elementDataDictionary');
const PipelineBuilder = require('../pipelineBuilder');

const Keys = [
  'header.user-agent',
  'header.sec-ch-ua',
  'header.sec-ch-ua-mobile',
  'header.sec-ch-ua-model',
  'header.sec-ch-ua-platform',
  'header.sec-ch-ua-platform-version',
  'header.sec-ch-ua-full-version-list',
  'query.user-agent',
  'query.51D_GetHighEntropyValues',
  'cookie.51D_GetHighEntropyValues'
];
const Checks = 100;
const Detections = 25;

/**
 * Makes a list of evidence keys that counts how often a key in it is put in
 * lower case.
 *
 * @param {string[]} keys the keys in the list
 * @returns {{list: string[], folds: Function}} the list, and a function that
 * returns how many times a key in the list has been put in lower case
 */
function countingList (keys) {
  let folds = 0;
  const list = keys.map((key) => {
    const counted = Object(key);
    counted.toLowerCase = function () {
      folds += 1;
      return String.prototype.toLowerCase.call(this);
    };
    return counted;
  });
  return { list, folds: () => folds };
}

test('checking keys puts the list in lower case once', () => {
  const { list, folds } = countingList(Keys);
  const filter = new BasicListEvidenceKeyFilter(list);
  for (let i = 0; i < Checks; i++) {
    expect(filter.filterEvidenceKey('Header.User-Agent')).toBe(true);
    expect(filter.filterEvidenceKey('header.accept')).toBeFalsy();
  }
  expect(folds()).toBe(Keys.length);
});

test('a detection does not put the list in lower case again', async () => {
  const { list, folds } = countingList(Keys);
  // Reads the evidence it accepts as the engines do, so each detection
  // checks the key filter as the evidence is added and again here.
  const element = new FlowElement({
    dataKey: 'test',
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(list),
    processInternal: function (flowData) {
      const accepted = this.evidenceKeyFilter.filterEvidence(
        flowData.evidence.getAll());
      flowData.setElementData(new ElementDataDictionary({
        flowElement: this,
        contents: { accepted: Object.keys(accepted) }
      }));
    },
    properties: { accepted: { type: 'string[]' } }
  });
  // The web integration elements are left out so that the test element is
  // the only one with a key filter, as in the performance example.
  const pipeline = new PipelineBuilder({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }).add(element).build();
  for (let i = 0; i < Detections; i++) {
    const flowData = pipeline.createFlowData();
    flowData.evidence.add('header.user-agent', 'a user agent');
    flowData.evidence.add('header.accept', 'text/html');
    await flowData.process();
    expect(flowData.get('test').get('accepted')).toEqual(['header.user-agent']);
  }
  expect(folds()).toBe(Keys.length);
});

test('a key matches the list ignoring letter case', () => {
  const upper = new BasicListEvidenceKeyFilter(['Header.User-Agent']);
  expect(upper.filterEvidenceKey('header.user-agent')).toBe(true);
  expect(upper.filterEvidenceKey('HEADER.USER-AGENT')).toBe(true);
  const lower = new BasicListEvidenceKeyFilter(['header.user-agent']);
  expect(lower.filterEvidenceKey('Header.User-Agent')).toBe(true);
});

test('a key not in the list is not kept', () => {
  const filter = new BasicListEvidenceKeyFilter(['header.user-agent']);
  expect(filter.filterEvidenceKey('header.accept')).toBeFalsy();
  const empty = new BasicListEvidenceKeyFilter([]);
  expect(empty.filterEvidenceKey('header.user-agent')).toBeFalsy();
});

test('a key added to the list after a check is kept', () => {
  const list = ['header.user-agent'];
  const filter = new BasicListEvidenceKeyFilter(list);
  expect(filter.filterEvidenceKey('header.accept')).toBeFalsy();
  list.push('Header.Accept');
  expect(filter.filterEvidenceKey('header.accept')).toBe(true);
});

test('a key changed in the list after a check is read again', () => {
  const list = ['header.user-agent', 'header.sec-ch-ua'];
  const filter = new BasicListEvidenceKeyFilter(list);
  expect(filter.filterEvidenceKey('header.user-agent')).toBe(true);
  list[0] = 'header.accept';
  expect(filter.filterEvidenceKey('header.user-agent')).toBeFalsy();
  expect(filter.filterEvidenceKey('header.accept')).toBe(true);
});

test('a list replaced after a check is read again', () => {
  const filter = new BasicListEvidenceKeyFilter(['header.user-agent']);
  expect(filter.filterEvidenceKey('header.user-agent')).toBe(true);
  filter.list = ['header.accept'];
  expect(filter.filterEvidenceKey('header.user-agent')).toBeFalsy();
  expect(filter.filterEvidenceKey('header.accept')).toBe(true);
});

test('filterEvidence keeps the listed keys with their values', () => {
  const filter = new BasicListEvidenceKeyFilter(['header.user-agent']);
  expect(filter.filterEvidence({
    'Header.User-Agent': 'a user agent',
    'header.accept': 'text/html'
  })).toEqual({ 'Header.User-Agent': 'a user agent' });
});
