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

// The Data update page of the pipeline specification says that a check for
// an update MUST be reported to onUpdateCallbacks once it ends, including
// the checks made by the file watcher, and gives the in progress status to
// a file watcher event that found nothing left to do. A download writes the
// new data to the path the watcher watches, so events arrive while the
// download is still being applied and each is reported as in progress
// before the download reports its own result. An example that takes the
// first report as the result of the check it asked for is handed one of
// those, so no example takes the first report, and every example that waits
// for a result passes over the in progress status.
//
// pipeline/fiftyone.pipeline.engines/tests/watchedDownloadReports.test.js
// shows the reports arriving in that order.

const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const FOLDERS = ['device-detection', 'ip-intelligence', 'location', 'pipeline'];

// Folders that hold no example of ours: installed packages, the scripts a
// page loads and the JavaScript templates submodule.
const SKIPPED_FOLDERS = ['node_modules', 'public', 'javascript-templates'];

// Every example file, which is every .js, .ts, .pug and .html file below an
// examples folder other than a test.
const exampleFiles = () => {
  const found = [];
  const pending = FOLDERS.map((folder) => ({
    dir: path.join(ROOT, folder), inExamples: false
  }));
  while (pending.length > 0) {
    const { dir, inExamples } = pending.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIPPED_FOLDERS.includes(entry.name)) {
          pending.push({
            dir: full, inExamples: inExamples || entry.name === 'examples'
          });
        }
      } else if (inExamples && /\.(js|ts|pug|html)$/.test(entry.name) &&
        !/\.test\.(js|ts)$/.test(entry.name)) {
        found.push(path.relative(ROOT, full).split(path.sep).join('/'));
      }
    }
  }
  return found.sort();
};

// The file's text with its comment lines left out, so that a listener in a
// documentation snippet is not read as one the example registers.
const code = (file) => fs.readFileSync(path.join(ROOT, file), 'utf8')
  .split(/\r?\n/)
  .filter((line) => {
    const trimmed = line.trim();
    return !trimmed.startsWith('*') && !trimmed.startsWith('//') &&
      !trimmed.startsWith('/*');
  })
  .join('\n');

// Every example that registers a listener for the reports of an update
// check.
const listening = exampleFiles()
  .filter((file) => code(file).includes("'updateComplete'"));

describe('examples that listen for the reports of an update check', () => {
  test('are found', () => {
    expect(listening.length).toBeGreaterThan(0);
  });

  describe.each(listening)('%s', (file) => {
    test('does not take the first report as the result', () => {
      expect(code(file)).not.toContain("once('updateComplete'");
    });

    test('passes over the in progress status', () => {
      expect(code(file)).toContain('AUTO_UPDATE_IN_PROGRESS');
    });
  });
});
