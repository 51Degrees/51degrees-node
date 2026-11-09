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

// The data update service logs the update URL, which carries the license
// keys, and the errors of a failed request. No log entry may hold a key in
// full.

const path = require('path');

const { Pipeline } = require('fiftyone.pipeline.core');
const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));

const KEY = 'ABCDEFGH1234';
const MASKED = '********1234';

test('a failed update request leaves only the masked key in the log',
  async () => {
    const logs = [];
    const pipeline = new Pipeline([]);
    for (const level of ['info', 'warn', 'error', 'debug']) {
      pipeline.on(level, (message) => logs.push({ level, message: String(message) }));
    }
    const service = new DataFileUpdateService(pipeline);
    const dataFile = {
      updateUrl: 'http://127.0.0.1:1/datafile?LicenseKeys=' + KEY +
        '&Type=HashV41',
      verifyIfModifiedSince: false,
      autoUpdate: false,
      updateOnStart: false,
      attemptedDownload: false,
      updating: false,
      flowElement: { dataKey: 'testEngine' }
    };
    const done = new Promise((resolve) => service.once('updateComplete',
      () => resolve()));
    service.updateDataFile(dataFile);
    await done;

    const text = logs.map((log) => log.message).join('\n');
    expect(text).toContain('LicenseKeys=' + MASKED);
    expect(text).not.toContain(KEY);
  });
