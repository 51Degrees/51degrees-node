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

// Every location example ends with a "Find out more" section that gives
// the person running it links to follow up. These checks read each
// example's source. examples/examples.test.js runs the console examples
// and checks what they print ends with the section.

const fs = require('fs');
const path = require('path');

// The location folder. Each link's utm_content is the path of its file
// below this folder.
const PRODUCT = path.join(__dirname, '..');

// This API's folder in the repository, which every section gives.
const REPOSITORY =
  'https://github.com/51Degrees/51degrees-node/tree/main/location';

// Every file that holds a section. The web example holds it in the page
// it writes.
const EXAMPLES = [
  'examples/combiningServices.js',
  'examples/configureFromFile.js',
  'examples/gettingStarted.js',
  'examples/webIntegration.js'
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

test('every example is checked', () => {
  const examples = fs.readdirSync(path.join(PRODUCT, 'examples'))
    .filter((name) => name.endsWith('.js') && !name.endsWith('.test.js'))
    .map((name) => `examples/${name}`);
  expect(examples.sort()).toEqual(EXAMPLES.slice().sort());
});

for (const file of EXAMPLES) {
  test(`${file} has the section`, () => {
    const text = fs.readFileSync(path.join(PRODUCT, file), 'utf8')
      .replace(/&amp;/g, '&');
    expect(text).toContain('Find out more');
    expect(text).toContain(REPOSITORY);
    const links = text.match(SECTION_LINK) || [];
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      expect(link).toMatch(sectionQuery(file));
    }
  });
}
