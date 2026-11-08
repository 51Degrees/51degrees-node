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

const FlowElement = require('../flowElement');
const PipelineBuilder = require('../pipelineBuilder');
const BasicListEvidenceKeyFilter = require('../basicListEvidenceKeyFilter');

const NOT_DECLARED = [
  'header.user-agent',
  'header.if-none-match',
  'header.x-test',
  'cookie.query',
  'query.session-id',
  'server.client-ip'
];

/**
 * An element that does not say which evidence it accepts accepts none.
 */
test('an element that declares no evidence accepts none', () => {
  const element = new FlowElement({ dataKey: 'declaresnothing' });
  NOT_DECLARED.forEach((key) => {
    expect(element.evidenceKeyFilter.filterEvidenceKey(key)).toBeFalsy();
  });
});

/**
 * Adding such an element to a pipeline does not make the pipeline keep
 * evidence that no other element accepts.
 */
test('an element that declares no evidence widens nothing', () => {
  const reads = new FlowElement({
    dataKey: 'reads',
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent'])
  });
  const pipeline = new PipelineBuilder()
    .add(reads)
    .add(new FlowElement({ dataKey: 'declaresnothing' }))
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', 'a browser');
  flowData.evidence.add('header.x-test', 'a header');
  expect(flowData.evidence.get('header.user-agent')).toBe('a browser');
  expect(flowData.evidence.get('header.x-test')).toBeUndefined();
});
