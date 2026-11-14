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

// Runs each example in its own process, from its own folder, as a person
// runs it, and checks every line it printed. An example that stops with an
// error, or prints anything else, such as an error it caught, fails its
// test. With a resource key the examples call the cloud service, and
// without one they say where to create one. Either way each ends with the
// Find out more section.

const childProcess = require('child_process');

const TIMEOUT_MS = 60000;
const RESOURCE_KEY = '_51DEGREES_RESOURCE_KEY';

// The deprecated name of the key, removed so that only the name above
// decides what the examples print.
const DEPRECATED_NAMES = ['RESOURCE_KEY'];

const COUNTRY = 'Which country is the location ' +
  '[51.458048,-0.9822207999999999] in? United Kingdom';
const MOBILE = 'Does the User-Agent \'Mozilla/5.0 (iPhone; CPU iPhone OS ' +
  '11_2 like Mac OS X) AppleWebKit/604.4.7 (KHTML, like Gecko) ' +
  'Mobile/15C114\' represent a mobile device? true';
const NEEDS_KEY = expect.stringMatching(
  /^You need to create a resource key at https:\/\/configure\.51degrees\.com/);
const NEEDS_ISMOBILE = 'Make sure to include the ismobile property as it ' +
  'is used by this example.';

const hasKey = Boolean(process.env[RESOURCE_KEY]);

// Every example ends with the Find out more section, which is a rule of 79
// equals signs, the heading, then one line per link, each a tab, a label
// and an address. It gives this API's folder, and its links to
// 51degrees.com are tagged with the example's file.
const RULE = '='.repeat(79);
const REPOSITORY =
  'https://github.com/51Degrees/51degrees-node/tree/main/location';

const expectFindOutMore = (file, lines) => {
  expect(lines.slice(0, 2)).toEqual([RULE, 'Find out more:']);
  const links = lines.slice(2);
  for (const line of links) {
    expect(line).toMatch(/^\t[A-Z][^:]*: https:\/\/\S+$/);
  }
  expect(links).toContain(`\tThis API: ${REPOSITORY}`);
  const tagged = links.filter((line) => line.includes('51degrees.com/'));
  expect(tagged.length).toBeGreaterThan(0);
  const content = `&utm_content=examples-${file.toLowerCase()}&`;
  expect(tagged.filter((line) => !line.includes(content))).toEqual([]);
};

// Runs an example and returns its exit status, its error output and the
// lines of its output. The deprecated names are removed without regard to
// case, as Windows matches them.
const runExample = (file) => {
  const remove = new Set(DEPRECATED_NAMES.map((name) => name.toUpperCase()));
  const env = Object.assign({}, process.env);
  for (const name of Object.keys(env)) {
    if (remove.has(name.toUpperCase())) {
      delete env[name];
    }
  }
  const result = childProcess.spawnSync(process.execPath, [file], {
    cwd: __dirname,
    env,
    encoding: 'utf8',
    timeout: TIMEOUT_MS
  });
  return {
    error: result.error,
    status: result.status,
    stderr: result.stderr,
    lines: (result.stdout || '').split(/\r?\n/).filter((line) => line !== '')
  };
};

// Checks the example printed the lines, then the Find out more section.
const expectLines = (file, lines) => {
  const result = runExample(file);
  const rule = result.lines.lastIndexOf(RULE);
  expect(rule).toBeGreaterThan(-1);
  expect(Object.assign({}, result, { lines: result.lines.slice(0, rule) }))
    .toEqual({
      error: undefined,
      status: 0,
      stderr: '',
      lines
    });
  expectFindOutMore(file, result.lines.slice(rule));
};

test('getting started', () => {
  expectLines('gettingStarted.js', hasKey ? [COUNTRY] : [NEEDS_KEY]);
}, TIMEOUT_MS * 2);

test('combining services', () => {
  expectLines('combiningServices.js',
    hasKey ? [COUNTRY, MOBILE] : [NEEDS_KEY, NEEDS_ISMOBILE]);
}, TIMEOUT_MS * 2);

test('configure from file', () => {
  expectLines('configureFromFile.js', hasKey ? [COUNTRY] : [NEEDS_KEY]);
}, TIMEOUT_MS * 2);
