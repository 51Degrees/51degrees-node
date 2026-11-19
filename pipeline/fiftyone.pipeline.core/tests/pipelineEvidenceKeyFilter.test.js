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

// advertize-accepted-evidence.md line 5: "All Flow Elements and Pipelines
// MUST be capable of programmatically describing the Evidence keys that
// they can make use of."

const core = require('fiftyone.pipeline.core');

const element = (dataKey, keys) => new core.FlowElement({
  dataKey,
  evidenceKeyFilter: new core.BasicListEvidenceKeyFilter(keys),
  processInternal: () => {}
});

const build = (...elements) => {
  const builder = new core.PipelineBuilder({ addJavaScriptBuilder: false });
  elements.forEach(e => builder.add(e));
  return builder.build();
};

test('the Pipeline accepts the Evidence any of its elements accepts', () => {
  const filter = build(
    element('one', ['header.user-agent']),
    element('two', ['query.mark'])).evidenceKeyFilter;
  expect(filter.filterEvidenceKey('header.user-agent')).toBe(true);
  expect(filter.filterEvidenceKey('Header.User-Agent')).toBe(true);
  expect(filter.filterEvidenceKey('query.mark')).toBe(true);
  expect(filter.filterEvidenceKey('cookie.other')).toBe(false);
});

test('the Pipeline reads its elements\' filters when asked', () => {
  const later = element('later', []);
  const filter = build(later).evidenceKeyFilter;
  expect(filter.filterEvidenceKey('header.x-later')).toBe(false);
  later.evidenceKeyFilter = new core.BasicListEvidenceKeyFilter(
    ['header.x-later']);
  expect(filter.filterEvidenceKey('header.x-later')).toBe(true);
});

test('Flow Data gives the Evidence its Pipeline accepts', () => {
  const flowData = build(element('one', ['header.user-agent']))
    .createFlowData();
  flowData.evidence.add('header.user-agent', 'a browser');
  flowData.evidence.add('cookie.other', 'not read');
  expect(flowData.getEvidenceDataKey())
    .toEqual({ 'header.user-agent': 'a browser' });
});
