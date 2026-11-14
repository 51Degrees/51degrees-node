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

// Every Pipeline API example, in this package and the packages beside it,
// ends with a "Find out more" section that gives the person running it
// links to follow up. These checks read each example's source.

const fs = require('fs');
const path = require('path');

// The pipeline folder. Each link's utm_content is the path of its file
// below this folder.
const PRODUCT = path.join(__dirname, '..', '..');

// This API's folder in the repository, which every section gives.
const REPOSITORY =
  'https://github.com/51Degrees/51degrees-node/tree/main/pipeline';

// Every file that holds a section. A web example holds it in its page.
const EXAMPLES = [
  'fiftyone.pipeline.cloudrequestengine/examples/cloudFlowElement.js',
  'fiftyone.pipeline.core/examples/customFlowElements/clientSideEvidenceFlowElement.js',
  'fiftyone.pipeline.core/examples/customFlowElements/simpleEvidenceFlowElement.js',
  'fiftyone.pipeline.core/examples/pipelines.js',
  'fiftyone.pipeline.did/examples/creator-context-web/page.html',
  'fiftyone.pipeline.did/examples/fodIdExample.js',
  'fiftyone.pipeline.engines/examples/caching.js',
  'fiftyone.pipeline.engines/examples/onPremiseFlowElement.js',
  'fiftyone.pipeline.engines.fiftyone/examples/usageSharing/usageSharing.js'
];

// The other files in the examples folders. These are the flow elements
// the pipelines example uses and the server of the 51Did demo, whose page
// holds the section.
const NOT_EXAMPLES = [
  'fiftyone.pipeline.core/examples/flowElementsForExamples/async.js',
  'fiftyone.pipeline.core/examples/flowElementsForExamples/neverRun.js',
  'fiftyone.pipeline.core/examples/flowElementsForExamples/stop.js',
  'fiftyone.pipeline.core/examples/flowElementsForExamples/sync.js',
  'fiftyone.pipeline.did/examples/creator-context-web/server.js'
];

// A 51degrees.com link in the section, whose utm_term starts with
// "find-out-more".
const SECTION_LINK =
  /https:\/\/51degrees\.com\/[^\s"'<>)`\\]*utm_term=find-out-more[^\s"'<>)`\\]*/g;

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

// Folders that hold no example: installed packages and the JavaScript
// templates submodule.
const SKIPPED_FOLDERS = ['node_modules', 'javascript-templates'];

// Every .js and .html file below an examples folder, other than tests.
const exampleFiles = (dir, inExamples = false) => {
  let found = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIPPED_FOLDERS.includes(entry.name)) {
        found = found.concat(
          exampleFiles(full, inExamples || entry.name === 'examples'));
      }
    } else if (inExamples && /\.(js|html)$/.test(entry.name) &&
      !entry.name.endsWith('.test.js')) {
      found.push(path.relative(PRODUCT, full).split(path.sep).join('/'));
    }
  }
  return found;
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
});
