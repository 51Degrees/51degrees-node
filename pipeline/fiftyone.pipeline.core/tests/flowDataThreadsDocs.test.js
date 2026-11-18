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

// Every web example, and the documentation of the web integration, says
// that a Flow Data cannot be used by two threads at once, and the examples
// show it by creating a Flow Data for each request.

const fs = require('fs');
const path = require('path');

const SENTENCE = 'must not be used by two threads at once';

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

// The comment lines directly above a line, joined into one sentence.
const commentAbove = (lines, index) => {
  const comment = [];
  for (let i = index - 1; i >= 0 && /^\s*\/\//.test(lines[i]); i--) {
    comment.unshift(lines[i].replace(/^\s*\/\/\s?/, ''));
  }
  return comment.join(' ').replace(/\s+/g, ' ');
};

describe('Flow Data and threads', () => {
  test('the core readme says a Flow Data is used by one thread at a time',
    () => {
      const readme = fs.readFileSync(
        path.resolve(__dirname, '..', 'readme.md'), 'utf8')
        .replace(/\s+/g, ' ');
      expect(readme).toContain('## Flow Data and threads');
      expect(readme).toContain(SENTENCE);
    });

  test('every web example says so where it creates the Flow Data for ' +
    'each request', () => {
    const examples = webExamples();
    expect(examples.length).toBeGreaterThan(10);
    for (const example of examples) {
      const lines = fs.readFileSync(example, 'utf8').split(/\r?\n/);
      const creates = lines
        .map((line, index) => ({ line, index }))
        .filter(({ line }) => /^\s*(const|let|var)\s+\w+\s*=\s*\w+\.createFlowData\(\)/
          .test(line));
      expect(creates.length).toBeGreaterThan(0);
      for (const { index } of creates) {
        expect([path.relative(root, example),
          commentAbove(lines, index).includes(SENTENCE)])
          .toEqual([path.relative(root, example), true]);
      }
    }
  });
});
