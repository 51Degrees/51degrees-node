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

// Checks the parameters the builder writes into the script, which the
// script reads whether or not it has a callback URL. Each script is parsed,
// which is what a browser does when it loads one, so no browser is needed.

const vm = require('vm');
const core = require('fiftyone.pipeline.core');

// The function the script returns its parameters from.
const parametersLine =
  /var renderedParameters = function\(\) \{ return (.*); \};/g;

async function render (options, evidence) {
  const pipeline = new core.PipelineBuilder({ addJavaScriptBuilder: false })
    .add(new core.JsonBundler())
    .add(new core.JavascriptBuilder(options))
    .build();
  const flowData = pipeline.createFlowData();
  for (const key in evidence) {
    flowData.evidence.add(key, evidence[key]);
  }
  await flowData.process();
  const script = flowData.javascriptbuilder.javascript;
  // eslint-disable-next-line no-new
  expect(() => new vm.Script(script, { filename: 'JavaScriptResource.js' }))
    .not.toThrow();
  return script;
}

/**
 * The parameters the script returns, which fails the test where the script
 * does not return exactly one object.
 *
 * @param {string} script the rendered script
 * @returns {object} the parameters
 */
function parameters (script) {
  const matches = [...script.matchAll(parametersLine)];
  expect(matches.length).toBe(1);
  expect(matches[0][1]).not.toBe('');
  return JSON.parse(matches[0][1]);
}

const withEndpoint = { endPoint: '/json', host: 'example.com' };

describe('parameters with and without a callback URL', () => {
  test('with no endpoint the query evidence is still written', async () => {
    const script = await render({}, { 'query.colour': 'red' });
    expect(parameters(script)).toEqual({ colour: 'red' });
  });

  test('with no endpoint and no query evidence the parameters are empty',
    async () => {
      const script = await render({}, { 'header.user-agent': 'Example' });
      expect(parameters(script)).toEqual({});
    });

  test('with an endpoint the query evidence is written as before',
    async () => {
      const script = await render(withEndpoint, { 'query.colour': 'red' });
      expect(parameters(script)).toEqual({ colour: 'red' });
    });

  test('the session id and sequence are left out without an endpoint',
    async () => {
      const script = await render({}, {
        'query.colour': 'red',
        'query.session-id': 'abc-123',
        'query.sequence': '2'
      });
      expect(parameters(script)).toEqual({ colour: 'red' });
    });
});
