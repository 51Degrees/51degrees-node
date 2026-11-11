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

// One name under several prefixes is sent once, with the value of the
// prefix evidence.md ranks highest. evidence.md lists query, header,
// cookie, server, fiftyone and location from highest to lowest precedence,
// and ranks any other prefix alphabetically after them.

const { PipelineBuilder } = require('fiftyone.pipeline.core');
const CloudRequestEngine = require('../cloudRequestEngine');
const MockRequestClient = require('./classes/mockRequestClient');

const ORDER = [
  'query', 'header', 'cookie', 'server', 'fiftyone', 'location', 'apple',
  'zebra'
];

/**
 * Build the content the engine would send for the evidence given.
 *
 * @param {Array<Array<string>>} evidence Keys and values, added in order
 * @param {Array<string>} warnings Receives the warnings logged
 * @returns {object} The content
 */
function content (evidence, warnings = []) {
  const engine = new CloudRequestEngine({
    resourceKey: 'AAAAAAAAAAAA',
    requestClient: new MockRequestClient()
  });
  const pipeline = new PipelineBuilder().add(engine).build();
  pipeline.on('warn', w => warnings.push(w));
  const data = pipeline.createFlowData();
  for (const [key, value] of evidence) {
    data.evidence.add(key, value);
  }
  return engine.getContent(data);
}

test('each prefix wins over every later one', () => {
  // Each pair gives one name, added higher first so the order added
  // cannot decide it.
  const evidence = [];
  ORDER.forEach((higher, i) => {
    for (const lower of ORDER.slice(i + 1)) {
      const name = `n-${higher}-${lower}`;
      evidence.push([`${higher}.${name}`, higher]);
      evidence.push([`${lower}.${name}`, lower]);
    }
  });

  const result = content(evidence);

  const wrong = [];
  ORDER.forEach((higher, i) => {
    for (const lower of ORDER.slice(i + 1)) {
      const name = `n-${higher}-${lower}`;
      if (result[name] !== higher) {
        wrong.push(`${name} sent ${result[name]}`);
      }
    }
  });
  expect(wrong).toStrictEqual([]);
});

test('a prefix ranks the same in any letter case', () => {
  // Evidence keys ignore letter case, so Location ranks as location,
  // SERVER as server and Header as header.
  const result = content([
    ['fiftyone.b', 'fiftyone'],
    ['Location.b', 'location'],
    ['SERVER.c', 'server'],
    ['Location.c', 'location'],
    ['Header.d', 'header'],
    ['cookie.d', 'cookie']
  ]);

  expect(result.b).toBe('fiftyone');
  expect(result.c).toBe('server');
  expect(result.d).toBe('header');
});

test('a query key in any letter case replaces another without a warning', () => {
  // A query key is expected to replace the same name under a lower
  // prefix, so no conflict is logged, whatever the letter case.
  const warnings = [];
  const result = content([
    ['Query.n', 'query'],
    ['header.n', 'header']
  ], warnings);

  expect(result.n).toBe('query');
  expect(warnings).toStrictEqual([]);
});

test('other prefixes rank by the prefix alone', () => {
  // ab comes before ab-c, although the key ab-c.n sorts before ab.n
  // because a hyphen sorts before a dot.
  const result = content([['ab.n', 'ab'], ['ab-c.n', 'ab-c']]);

  expect(result.n).toBe('ab');
});

test('one name in two letter cases is sent once, from the higher prefix', () => {
  // Evidence keys ignore letter case, so header.User-Agent and
  // query.user-agent name the same value. The name is sent once, spelled
  // as the winning key spells it.
  const result = content([
    ['header.User-Agent', 'from the header'],
    ['query.user-agent', 'from the query'],
    ['server.X-Thing', 'from the server'],
    ['fiftyone.x-thing', 'from fiftyone']
  ]);

  const names = Object.keys(result).filter(name =>
    ['user-agent', 'x-thing'].includes(name.toLowerCase()));
  expect(names.sort()).toStrictEqual(['X-Thing', 'user-agent']);
  expect(result['user-agent']).toBe('from the query');
  expect(result['X-Thing']).toBe('from the server');
});
