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

// The Sequence Element counts a query.sequence only when it is held in one
// of the language's integer types, or is text made only of the digits 0 to
// 9, from 0 up to 2,147,483,646. Every ordinary JavaScript number is a
// floating-point value, with 2.0 and 2 the same number, so in Node.js only a
// BigInt or digit-only text counts.

const path = require('path');

const PipelineBuilder = require(path.resolve(__dirname, '..', 'pipelineBuilder'));
const SequenceElement = require(path.resolve(__dirname, '..', 'sequenceElement'));

// The sequence the Sequence Element gives in one session for a
// query.sequence.
const sequenceFor = async (given) => {
  const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
    .add(new SequenceElement())
    .build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('query.session-id', 'abc-123');
  flowData.evidence.add('query.sequence', given);
  await flowData.process();
  return flowData.get('sequence').get('sequence');
};

describe('the Sequence Element', () => {
  test.each([
    [BigInt(2), 3],
    ['2', 3],
    ['0002', 3],
    [BigInt(0), 1],
    ['0', 1],
    [BigInt(2147483646), 2147483647],
    ['2147483646', 2147483647]
  ])('counts %p, giving %p', async (given, expected) => {
    expect(await sequenceFor(given)).toBe(expected);
  });

  test.each([
    2,
    2.0,
    5,
    2.5,
    -1,
    BigInt(-1),
    BigInt(2147483647),
    '2147483647',
    '-1',
    '2.0',
    ' 2',
    'abc',
    NaN
  ])('counts %p as absent, giving 1', async (given) => {
    expect(await sequenceFor(given)).toBe(1);
  });
});
