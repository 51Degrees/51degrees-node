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

const path = require('path');

const PipelineBuilder = require(path.resolve(__dirname, '..', 'pipelineBuilder'));
const FlowElement = require(path.resolve(__dirname, '..', 'flowElement'));

// Builds a pipeline from the elements given and nothing else, so the last
// element given is the last element run.
const build = (elements, settings = {}) => {
  const builder = new PipelineBuilder(Object.assign({
    addJavaScriptBuilder: false,
    useSetHeaderProperties: false
  }, settings));
  elements.forEach((element) => builder.add(element));
  return builder.build();
};

// An element that fails with the error given.
const failing = (failure, { dataKey = 'failing', asynchronous = false } = {}) =>
  new FlowElement({
    dataKey,
    processInternal: function () {
      if (asynchronous) {
        return Promise.reject(failure);
      }
      throw failure;
    }
  });

// An element that records that it ran.
const recording = (dataKey, ran) => new FlowElement({
  dataKey,
  processInternal: function () {
    ran.push(dataKey);
  }
});

// The rejection of process, or undefined if it resolved.
const rejectionOf = (flowData) => flowData.process().then(
  () => undefined, (rejection) => rejection);

let consoleError;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// Once every flow element has run, process rejects with an AggregateError
// holding every recorded error, unless exceptions are suppressed, in which
// case the errors are recorded and logged and nothing is thrown.
describe('process', () => {
  test('rejects with every recorded error when the last element fails',
    async () => {
      const failure = new Error('element failed');
      const flowData = build([failing(failure)]).createFlowData();
      const rejection = await rejectionOf(flowData);
      expect(rejection).toHaveProperty('name', 'AggregateError');
      expect(rejection.errors.length).toBe(1);
      expect(rejection.errors[0]).toBe(failure);
      expect(flowData.errors.failing).toBe(failure);
      expect(consoleError).toHaveBeenCalledWith(
        expect.stringContaining('element failed'));
    });

  test('rejects with every recorded error with an error listener attached',
    async () => {
      const failure = new Error('element failed');
      const pipeline = build([failing(failure)]);
      const heard = [];
      pipeline.on('error', (message) => heard.push(message));
      const rejection = await rejectionOf(pipeline.createFlowData());
      expect(rejection).toHaveProperty('name', 'AggregateError');
      expect(rejection.errors[0]).toBe(failure);
      expect(heard.length).toBe(1);
      expect(consoleError).not.toHaveBeenCalled();
    });

  test('runs every element after a failure before rejecting', async () => {
    const failure = new Error('element failed');
    const ran = [];
    const pipeline = build([
      failing(failure), recording('second', ran), recording('third', ran)]);
    pipeline.on('error', () => {});
    const rejection = await rejectionOf(pipeline.createFlowData());
    expect(ran).toEqual(['second', 'third']);
    expect(rejection).toHaveProperty('name', 'AggregateError');
    expect(rejection.errors[0]).toBe(failure);
  });

  test('includes every error in the order the elements ran', async () => {
    const first = new Error('first failed');
    const second = new Error('second failed');
    const pipeline = build([
      failing(first, { dataKey: 'first' }),
      failing(second, { dataKey: 'second' })]);
    pipeline.on('error', () => {});
    const rejection = await rejectionOf(pipeline.createFlowData());
    expect(rejection).toHaveProperty('name', 'AggregateError');
    expect(rejection.errors.length).toBe(2);
    expect(rejection.errors[0]).toBe(first);
    expect(rejection.errors[1]).toBe(second);
  });

  test('rejects once every element has run after an asynchronous failure',
    async () => {
      const failure = new Error('element failed');
      const ran = [];
      const flowData = build([
        failing(failure, { asynchronous: true }),
        recording('second', ran)]).createFlowData();
      const rejection = await rejectionOf(flowData);
      expect(ran).toEqual(['second']);
      expect(rejection).toHaveProperty('name', 'AggregateError');
      expect(rejection.errors[0]).toBe(failure);
    });

  test('resolves with the errors recorded and logged when exceptions are ' +
    'suppressed', async () => {
    const failure = new Error('element failed');
    const flowData = build([failing(failure)],
      { suppressProcessExceptions: true }).createFlowData();
    await expect(flowData.process()).resolves.toBe(flowData);
    expect(flowData.errors.failing).toBe(failure);
    expect(consoleError).toHaveBeenCalledWith(
      expect.stringContaining('element failed'));
  });

  test('resolves when no element fails', async () => {
    const ran = [];
    const flowData = build([recording('only', ran)]).createFlowData();
    await expect(flowData.process()).resolves.toBe(flowData);
    expect(ran).toEqual(['only']);
  });
});
