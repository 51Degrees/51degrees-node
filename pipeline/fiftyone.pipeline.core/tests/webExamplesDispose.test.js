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

// The web examples are this package's web integration. Each creates a Flow
// Data for each request and disposes of it when the request ends, so its
// Element Data goes back to the pools.

const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..', '..', '..');

// Every example that serves web requests, reads the evidence from a request
// and creates a Flow Data.
const webExamples = () => {
  const found = [];
  const walk = (folder) => {
    for (const entry of fs.readdirSync(folder, { withFileTypes: true })) {
      const full = path.join(folder, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== 'public') {
          walk(full);
        }
      } else if (entry.name.endsWith('.js') &&
        !entry.name.endsWith('.test.js') &&
        full.split(path.sep).includes('examples')) {
        const text = fs.readFileSync(full, 'utf8');
        if (text.includes('createServer') &&
          text.includes('evidence.addFromRequest') &&
          text.includes('createFlowData(')) {
          found.push(full);
        }
      }
    }
  };
  for (const top of ['pipeline', 'device-detection', 'ip-intelligence',
    'location']) {
    walk(path.join(root, top));
  }
  return found;
};

// The next line after index that is neither blank nor a comment.
const nextCode = (lines, index) => {
  for (let i = index + 1; i < lines.length; i++) {
    if (!/^\s*(\/\/.*)?$/.test(lines[i])) {
      return lines[i].trim();
    }
  }
  return undefined;
};

test('every web example disposes of the Flow Data it creates for a ' +
  'request when the response closes', () => {
  const examples = webExamples();
  expect(examples.length).toBeGreaterThan(10);
  for (const example of examples) {
    const lines = fs.readFileSync(example, 'utf8').split(/\r?\n/);
    const creates = lines
      .map((line, index) => ({
        match: /^\s*(?:const|let|var)\s+(\w+)\s*=\s*\w+\.createFlowData\(\)/
          .exec(line),
        index
      }))
      .filter(({ match }) => match !== null);
    expect([path.relative(root, example), creates.length > 0])
      .toEqual([path.relative(root, example), true]);
    for (const { match, index } of creates) {
      expect([path.relative(root, example), nextCode(lines, index)])
        .toEqual([path.relative(root, example),
          `res.on('close', () => ${match[1]}.dispose());`]);
    }
  }
});
