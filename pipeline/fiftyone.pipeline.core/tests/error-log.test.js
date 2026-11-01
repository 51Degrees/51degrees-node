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

const path = require('path');

const Pipeline = require(path.resolve(__dirname, '..', 'pipeline'));

let consoleError;

beforeEach(() => {
  consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

// Node throws an 'error' event that nothing listens for, so the pipeline
// writes such an error to the console instead.
test('error with no listener is written to the console rather than thrown',
  () => {
    const pipeline = new Pipeline([]);
    const error = new Error('something failed');
    expect(() => pipeline.log('error', error)).not.toThrow();
    expect(consoleError).toHaveBeenCalledWith(error);
  });

test('error with a listener reaches the listener and not the console', () => {
  const pipeline = new Pipeline([]);
  const heard = [];
  pipeline.on('error', (message) => heard.push(message));
  pipeline.log('error', 'something failed');
  expect(heard).toEqual(['something failed']);
  expect(consoleError).not.toHaveBeenCalled();
});

test('other levels with no listener are neither thrown nor written', () => {
  const pipeline = new Pipeline([]);
  expect(() => pipeline.log('warn', 'something odd')).not.toThrow();
  expect(consoleError).not.toHaveBeenCalled();
});
