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

// A person who runs a cloud example from a fresh clone has no resource key
// set. Each cloud example is run here from its own folder with no resource
// key, and must end without an error, name the environment variable to set,
// give a tagged link to the page where a resource key is created and end
// with its Find out more section.

const childProcess = require('child_process');
const path = require('path');

// The location package's folder.
const PRODUCT = path.join(__dirname, '..');

// Every cloud example, consoles and web servers alike.
const CLOUD_EXAMPLES = [
  'examples/combiningServices.js',
  'examples/configureFromFile.js',
  'examples/gettingStarted.js',
  'examples/webIntegration.js'
];

// The names a resource key is read from, removed for the run, and jest's
// own variable, which some examples read to tell a test run apart.
const REMOVED_NAMES = [
  '_51DEGREES_RESOURCE_KEY',
  '51DEGREES_RESOURCE_KEY',
  'RESOURCE_KEY',
  'JEST_WORKER_ID'
];

// The environment variable an example names for the resource key.
const RESOURCE_KEY_NAME = '_51DEGREES_RESOURCE_KEY';

// A link to the page where a resource key is created, tagged as every link
// an example prints is.
const CREATE_KEY_LINK = new RegExp(
  'https://51degrees\\.com/configure[^\\s\'"<>]*' +
  '\\?utm_source=code&utm_medium=example&utm_campaign=51degrees-node&');

// Long enough for an example to start and stop. A web example that starts
// its server with no key runs until this ends it.
const TIMEOUT_MS = 30000;

// Runs an example from its own folder with no resource key. A web example
// that does start its server listens on a port the system chooses.
const runWithoutKey = (file) => {
  const remove = new Set(REMOVED_NAMES.map((name) => name.toUpperCase()));
  const env = {};
  for (const [name, value] of Object.entries(process.env)) {
    if (!remove.has(name.toUpperCase())) {
      env[name] = value;
    }
  }
  env.PORT = '0';
  const full = path.join(PRODUCT, file);
  return childProcess.spawnSync(process.execPath, [path.basename(full)], {
    cwd: path.dirname(full),
    env,
    encoding: 'utf8',
    timeout: TIMEOUT_MS
  });
};

// The lines after the last Find out more heading, which end what the
// example printed.
const sectionLinks = (printed) => {
  const lines = printed.split(/\r?\n/).filter((line) => line.trim() !== '');
  const heading = lines.lastIndexOf('Find out more:');
  return heading < 0 ? [] : lines.slice(heading + 1);
};

for (const file of CLOUD_EXAMPLES) {
  test(`${file} ends cleanly and says how to get a key`, () => {
    const result = runWithoutKey(file);
    const printed = `${result.stdout || ''}\n${result.stderr || ''}`;
    // What the example printed is shown when it did not end cleanly.
    expect({
      status: result.status,
      signal: result.signal,
      printed: result.status === 0 ? '' : printed
    }).toEqual({ status: 0, signal: null, printed: '' });
    expect(printed).toContain(RESOURCE_KEY_NAME);
    expect(printed).toMatch(CREATE_KEY_LINK);
    const links = sectionLinks(result.stdout || '');
    expect(links.length).toBeGreaterThan(0);
    for (const line of links) {
      expect(line).toMatch(/^\t[A-Z][^:]*: https:\/\/\S+$/);
    }
  }, TIMEOUT_MS + 5000);
}
