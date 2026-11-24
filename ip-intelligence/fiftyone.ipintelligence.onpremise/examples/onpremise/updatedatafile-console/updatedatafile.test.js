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

// The example names the product to download only when it is given one, or
// one is set in _51DEGREES_IPI_PRODUCT, so a license key that holds one
// product downloads as before. Nothing is downloaded here. The settings the
// example gives the Pipeline builder are read as they are.

const path = require('path');

const example = require(path.join(__dirname, 'updatedatafile.js'));

const KEY = 'ABCDEFGH1234';

describe('the product the update example asks for', () => {
  const variable = '_51DEGREES_IPI_PRODUCT';
  let saved;

  beforeEach(() => {
    saved = process.env[variable];
    delete process.env[variable];
  });

  afterEach(() => {
    if (saved === undefined) {
      delete process.env[variable];
    } else {
      process.env[variable] = saved;
    }
  });

  test.each([undefined, null, ''])(
    'is not named when none is given (%p)', (product) => {
      expect(example.productSettings(KEY, product)).toEqual({});
    });

  test('is named in the update URL when IPIV4Enterprise is given', () => {
    const settings = example.productSettings(KEY, 'IPIV4Enterprise');

    expect(settings.dataUpdateUseUrlFormatter).toBe(false);
    const url = new URL(settings.dataUpdateUrl);
    expect(url.origin + url.pathname)
      .toBe('https://distributor.51degrees.com/api/v2/download');
    expect(url.searchParams.getAll('Product')).toEqual(['IPIV4Enterprise']);
    expect(url.searchParams.get('Type')).toBe('IPIV41');
    expect(url.searchParams.get('Download')).toBe('True');
    expect(url.searchParams.get('licenseKeys')).toBe(KEY);
  });

  test('is read from _51DEGREES_IPI_PRODUCT', () => {
    process.env[variable] = 'IPIV4Enterprise';

    expect(example.getProduct()).toBe('IPIV4Enterprise');
  });

  test.each([undefined, ''])(
    'is not read when _51DEGREES_IPI_PRODUCT is %p', (value) => {
      if (value !== undefined) {
        process.env[variable] = value;
      }

      expect(example.getProduct()).toBeUndefined();
    });
});
