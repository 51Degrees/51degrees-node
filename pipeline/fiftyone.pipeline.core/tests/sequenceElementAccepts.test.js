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

// The sequence element accepts the session id and sequence it reads, as its
// specification says, rather than relying on another element to keep them.

const path = require('path');

const PipelineBuilder = require(path.resolve(__dirname, '..', 'pipelineBuilder'));
const SequenceElement = require(path.resolve(__dirname, '..', 'sequenceElement'));

test('the sequence element accepts the session id and the sequence', () => {
  const sequence = new SequenceElement();

  expect(sequence.evidenceKeyFilter.filterEvidenceKey('query.session-id'))
    .toBe(true);
  expect(sequence.evidenceKeyFilter.filterEvidenceKey('query.sequence'))
    .toBe(true);
  expect(sequence.evidenceKeyFilter.filterEvidenceKey('header.x-test'))
    .toBeFalsy();
});

test('alone in a pipeline, the sequence element keeps the session going',
  async () => {
    const pipeline = new PipelineBuilder({
      addJavaScriptBuilder: false,
      useSetHeaderProperties: false
    }).add(new SequenceElement()).build();

    const first = pipeline.createFlowData();
    await first.process();
    const sessionId = first.evidence.get('query.session-id');
    expect(typeof sessionId).toBe('string');
    expect(first.evidence.get('query.sequence')).toBe(1);

    const next = pipeline.createFlowData();
    next.evidence.add('query.session-id', sessionId);
    next.evidence.add('query.sequence', '1');
    await next.process();
    expect(next.evidence.get('query.session-id')).toBe(sessionId);
    expect(next.evidence.get('query.sequence')).toBe(2);
  });
