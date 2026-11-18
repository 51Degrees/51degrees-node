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

// The usage sharing element is the last Flow Element in a Pipeline and never
// in a parallel group, so it shares the Evidence every other Flow Element
// has added, while nothing else changes it. A builder puts it last, and
// refuses a Pipeline that puts it anywhere else, built in code or from a
// configuration. A query string or form parameter is shared only when its
// name starts with 51D_ or a Flow Element of the Pipeline accepts it.

const path = require('path');
const {
  PipelineBuilder, FlowElement, BasicListEvidenceKeyFilter
} = require('fiftyone.pipeline.core');
const ShareUsage = require('../shareUsage');

const NOT_LAST = 'The usage sharing element must be the last Flow ' +
  'Element in a Pipeline, and outside any parallel group.';

const usage = () => new ShareUsage({ requestedPackageSize: 1000 });

const element = (dataKey, keys = []) => new FlowElement({
  dataKey,
  evidenceKeyFilter: new BasicListEvidenceKeyFilter(keys)
});

const lastOf = (pipeline) =>
  pipeline.flowElementsChain[pipeline.flowElementsChain.length - 1];

describe('The usage sharing element', () => {
  test('stays last after the elements the builder adds', () => {
    const sharing = usage();
    const pipeline = new PipelineBuilder()
      .add(element('first'))
      .add(sharing)
      .build();
    expect(lastOf(pipeline)).toBe(sharing);
    expect(pipeline.flowElementsChain.map((slot) => slot.dataKey))
      .toEqual(['sequence', 'first', 'jsonbundler', 'javascriptbuilder',
        'set-headers', 'shareUsage']);
  });

  test('a builder adds is last, after elements added later, and once ' +
    'however often it builds', () => {
    const builder = new PipelineBuilder();
    const sharing = usage();
    builder.usageSharingElement = sharing;
    builder.add(element('later'));
    expect(lastOf(builder.build())).toBe(sharing);
    const again = builder.build();
    expect(lastOf(again)).toBe(sharing);
    expect(again.flowElementsChain.filter((slot) => slot === sharing))
      .toHaveLength(1);
  });

  test('anywhere but last is refused', () => {
    expect(() => new PipelineBuilder()
      .add(usage())
      .add(element('after'))
      .build()).toThrow(NOT_LAST);
  });

  test('in a parallel group is refused', () => {
    expect(() => new PipelineBuilder()
      .addParallel([element('member'), usage()])
      .build()).toThrow(NOT_LAST);
  });

  test('anywhere but last in a configuration is refused', () => {
    const shareUsagePath = path.resolve(__dirname, '../shareUsage');
    const elementPath = path.resolve(__dirname,
      '../../fiftyone.pipeline.core/tests/configTestFlowElement');
    expect(() => new PipelineBuilder().buildFromConfiguration({
      PipelineOptions: {
        Elements: [
          { elementName: shareUsagePath },
          { elementName: elementPath, elementParameters: { built: 'x' } }
        ]
      }
    })).toThrow(NOT_LAST);
  });

  test('shares a parameter whose name starts with 51D_ or that a Flow ' +
    'Element accepts, and no other, whatever the settings', () => {
    for (const options of [{}, { shareAllQueryStringParameters: true },
      { queryWhitelist: ['campaign', 'password'] }, { shareAll: true }]) {
      const sharing = new ShareUsage(Object.assign(
        { requestedPackageSize: 1000 }, options));
      const pipeline = new PipelineBuilder({ addJavaScriptBuilder: false })
        .add(element('reader', ['query.user-agent']))
        .add(sharing)
        .build();
      const flowData = pipeline.createFlowData();
      flowData.evidence.add('query.51D_ScreenPixelsWidth', '1080');
      flowData.evidence.add('query.user-agent', 'agent');
      flowData.evidence.add('query.campaign', 'autumn');
      flowData.evidence.add('query.password', 'secret');
      flowData.evidence.add('header.user-agent', 'agent');
      const data = sharing.getDataFromEvidence(flowData);
      expect([options, Object.keys(data.evidenceData.query).sort()])
        .toEqual([options, ['51D_ScreenPixelsWidth', 'user-agent']]);
      expect([options, data.evidenceData.header['user-agent']])
        .toEqual([options, 'agent']);
    }
  });
});
