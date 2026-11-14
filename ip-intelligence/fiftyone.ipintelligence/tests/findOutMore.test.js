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

// Every IP Intelligence example ends with a "Find out more" section that
// gives the person running it links to follow up. The first checks read
// each example's source. The others run the cloud examples with no
// resource key, which ends them early without calling the cloud service,
// and check what they print ends with the section. The examples that
// need a data file are run to the end by examplesWithoutSettings.test.js.

const childProcess = require('child_process');
const fs = require('fs');
const path = require('path');

// The IP Intelligence folder. Each link's utm_content is the path of its
// file below this folder.
const PRODUCT = path.join(__dirname, '..', '..');

// This API's folder in the repository, which every section gives.
const REPOSITORY =
  'https://github.com/51Degrees/51degrees-node/tree/main/ip-intelligence';

// Every file that holds a section. A web example holds it in its page.
const EXAMPLES = [
  'fiftyone.ipintelligence/examples/gettingStarted.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/getallproperties-console/getAllProperties.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-console/gettingStarted.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-web/index.pug',
  'fiftyone.ipintelligence.cloud/examples/cloud/metadata-console/metaData.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-console/gettingStarted.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-web/index.pug',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/dataFileSystemWatcher.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/updateOnStartUp.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/automaticupdates/updatePollingInterval.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/compare-console/compare.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/country-translation-console/gettingStarted.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-console/gettingStarted.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-web/index.pug',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/metadata-console/metaData.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/metrics-console/metrics.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-api/gettingStarted.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-console/gettingStarted.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-web/index.pug',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/offlineprocessing-console/offlineProcessing.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/performance-console/performance.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/suspicious-console/suspicious.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/updatedatafile-console/updatedatafile.js'
];

// The other files in the examples folders. These are the helpers the
// examples share and the web servers, whose page holds the section.
const NOT_EXAMPLES = [
  'fiftyone.ipintelligence.cloud/examples/cloud/exampleUtils.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-web/gettingStarted.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-web/gettingStarted.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/areas.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/exampleUtils.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/gettingstarted-web/gettingStarted.js',
  'fiftyone.ipintelligence.onpremise/examples/onpremise/mixed/gettingstarted-web/gettingStarted.js',
  'fiftyone.ipintelligence.shared/examples/dataExtension.js',
  'fiftyone.ipintelligence.shared/examples/exampleConstants.js',
  'fiftyone.ipintelligence.shared/examples/optionsExtension.js'
];

// The cloud examples, each run from its own folder with no resource key.
const CLOUD_EXAMPLES = [
  'fiftyone.ipintelligence/examples/gettingStarted.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/getallproperties-console/getAllProperties.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/gettingstarted-console/gettingStarted.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/metadata-console/metaData.js',
  'fiftyone.ipintelligence.cloud/examples/cloud/mixed/gettingstarted-console/gettingStarted.js'
];

// The names a resource key is read from, removed for the early end.
const RESOURCE_KEY_NAMES = ['_51DEGREES_RESOURCE_KEY', 'RESOURCE_KEY'];

// A 51degrees.com link in the section, whose utm_term starts with
// "find-out-more".
const SECTION_LINK =
  /https:\/\/51degrees\.com\/[^\s"'<>)`\\]*utm_term=find-out-more[^\s"'<>)`\\]*/g;

const TIMEOUT_MS = 60000;

// The utm_content of a link in the file, which is the file's path below
// the product folder with each separator a hyphen, in lower case.
const slug = (file) => file.split('/').join('-').toLowerCase();

const escapeRegExp = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// The query a section link in the file carries.
const sectionQuery = (file) => new RegExp(
  '\\?utm_source=code&utm_medium=example&utm_campaign=51degrees-node' +
  `&utm_content=${escapeRegExp(slug(file))}` +
  '&utm_term=find-out-more[a-z0-9-]*$');

// What the file lacks of the section, one line for each thing, so that a
// failure names it rather than printing the whole file.
const problems = (file) => {
  const text = fs.readFileSync(path.join(PRODUCT, file), 'utf8')
    .replace(/&amp;/g, '&');
  const found = [];
  if (!text.includes('Find out more')) {
    found.push('no "Find out more" heading');
  }
  if (!text.includes(REPOSITORY)) {
    found.push(`no link to ${REPOSITORY}`);
  }
  const links = text.match(SECTION_LINK) || [];
  if (links.length === 0) {
    found.push('no 51degrees.com link with a utm_term of find-out-more');
  }
  for (const link of links) {
    if (!sectionQuery(file).test(link)) {
      found.push(`a link not tagged with this file: ${link}`);
    }
  }
  return found;
};

// Folders that hold no example: installed packages, the scripts a page
// loads and the JavaScript templates submodule.
const SKIPPED_FOLDERS = ['node_modules', 'public', 'javascript-templates'];

// Every .js, .pug and .html file below an examples folder, other than
// tests.
const exampleFiles = (dir, inExamples = false) => {
  let found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.includes(entry.name)) {
        found = found.concat(
          exampleFiles(full, inExamples || entry.name === 'examples'));
      }
    } else if (inExamples && /\.(js|pug|html)$/.test(entry.name) &&
      !entry.name.endsWith('.test.js')) {
      found.push(path.relative(PRODUCT, full).split(path.sep).join('/'));
    }
  }
  return found;
};

// Runs an example from its own folder with no resource key and returns
// what it printed.
const printedWithoutKey = (file) => {
  const remove = new Set(RESOURCE_KEY_NAMES.concat(['JEST_WORKER_ID'])
    .map((name) => name.toUpperCase()));
  const env = Object.assign({}, process.env);
  for (const name of Object.keys(env)) {
    if (remove.has(name.toUpperCase())) {
      delete env[name];
    }
  }
  const full = path.join(PRODUCT, file);
  const result = childProcess.spawnSync(
    process.execPath, [path.basename(full)], {
      cwd: path.dirname(full),
      env,
      encoding: 'utf8',
      timeout: TIMEOUT_MS
    });
  return result.stdout || '';
};

// Checks the printed text ends with the section, which is a rule of 79
// equals signs, the heading, then one line per link, each a tab, a label
// and an address.
const expectEndsWithSection = (printed, file) => {
  const lines = printed.split(/\r?\n/).filter((line) => line.trim() !== '');
  const heading = lines.lastIndexOf('Find out more:');
  expect(heading).toBeGreaterThan(0);
  expect(lines[heading - 1]).toBe('='.repeat(79));
  const links = lines.slice(heading + 1);
  expect(links.length).toBeGreaterThan(0);
  for (const line of links) {
    expect(line).toMatch(/^\t[A-Z][^:]*: https:\/\/\S+$/);
  }
  expect(links).toContain(`\tThis API: ${REPOSITORY}`);
  const tagged = links.filter((line) => line.includes('51degrees.com/'));
  expect(tagged.length).toBeGreaterThan(0);
  for (const line of tagged) {
    expect(line).toMatch(sectionQuery(file));
  }
};

describe('Find out more', () => {
  test('every example is checked', () => {
    expect(exampleFiles(PRODUCT).sort())
      .toEqual(EXAMPLES.concat(NOT_EXAMPLES).sort());
  });

  for (const file of EXAMPLES) {
    test(`${file} has the section`, () => {
      expect(problems(file)).toEqual([]);
    });
  }

  for (const file of CLOUD_EXAMPLES) {
    test(`${file} ends with the section when it has no resource key`, () => {
      expectEndsWithSection(printedWithoutKey(file), file);
    }, TIMEOUT_MS);
  }
});
