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

// An element accepts only the evidence that can change its results,
// because the evidence a pipeline's elements accept is what caching, the
// client-side ETag and the Vary header are built from.

const path = require('path');

const PipelineBuilder = require(path.resolve(__dirname, '..', 'pipelineBuilder'));
const FlowElement = require(path.resolve(__dirname, '..', 'flowElement'));
const BasicListEvidenceKeyFilter = require(
  path.resolve(__dirname, '..', 'basicListEvidenceKeyFilter'));
const SetHeadersElement = require(
  path.resolve(__dirname, '..', 'setHeadersElement'));

/**
 * The default pipeline, with the JavaScript builder, the JSON bundler, the
 * sequence element and the set headers element, and a test engine that
 * reads the User-Agent.
 *
 * @returns {object} the pipeline
 */
const defaultPipeline = () => new PipelineBuilder()
  .add(new FlowElement({
    dataKey: 'test',
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
    processInternal: () => {}
  }))
  .build();

/**
 * The elements of a pipeline that accept an evidence key.
 *
 * @param {object} pipeline the pipeline
 * @param {string} key the evidence key
 * @returns {Array<string>} the data keys of the elements that accept it
 */
const acceptedBy = (pipeline, key) => Object.values(pipeline.flowElements)
  .filter((element) => element.evidenceKeyFilter.filterEvidenceKey(key))
  .map((element) => element.dataKey);

test('the default pipeline does not accept headers no element reads', () => {
  const pipeline = defaultPipeline();

  expect(acceptedBy(pipeline, 'header.if-none-match')).toEqual([]);
  expect(acceptedBy(pipeline, 'header.x-test')).toEqual([]);
  expect(acceptedBy(pipeline, 'cookie.x-test')).toEqual([]);
  expect(acceptedBy(pipeline, 'server.x-test')).toEqual([]);
});

test('the default pipeline accepts the evidence its elements read', () => {
  const pipeline = defaultPipeline();

  expect(acceptedBy(pipeline, 'header.user-agent')).toEqual(['test']);
  expect(acceptedBy(pipeline, 'header.host')).toEqual(['javascriptbuilder']);
  expect(acceptedBy(pipeline, 'header.protocol'))
    .toEqual(['javascriptbuilder']);
  expect(acceptedBy(pipeline, 'query.fod-js-object-name'))
    .toEqual(['javascriptbuilder']);
  expect(acceptedBy(pipeline, 'query.session-id')).toEqual(['sequence']);
  // A query string parameter no element reads is not accepted, even though
  // the script carries it into its callback.
  expect(acceptedBy(pipeline, 'query.a')).toEqual([]);
});

test('the set headers element accepts no evidence', () => {
  const element = new SetHeadersElement();

  expect(element.evidenceKeyFilter.filterEvidenceKey('header.user-agent'))
    .toBeFalsy();
  expect(element.evidenceKeyFilter.filterEvidenceKey('query.x-test'))
    .toBeFalsy();
});
