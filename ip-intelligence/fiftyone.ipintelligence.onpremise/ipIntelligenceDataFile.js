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

const querystring = require('querystring');

const engines = require('fiftyone.pipeline.engines');

const DataFile = engines.DataFile;

/**
 * The parameters in the query of a URL, as they are written.
 *
 * @param {string} url the URL
 * @returns {{start: number, end: number, parameters: string[]}} where the
 * query starts and ends in the URL, and its parameters, or undefined where
 * the URL has no query
 */
const queryOf = function (url) {
  const start = url.indexOf('?');
  if (start < 0) {
    return undefined;
  }
  const hash = url.indexOf('#', start);
  const end = hash < 0 ? url.length : hash;
  return {
    start,
    end,
    parameters: url.substring(start + 1, end).split('&')
  };
};

/**
 * Whether a query parameter, as it is written, is a Product parameter. The
 * name is matched ignoring case.
 *
 * @param {string} parameter the parameter
 * @returns {boolean} true for a Product parameter
 */
const isProduct = function (parameter) {
  const name = parameter.split('=')[0];
  return querystring.unescape(name).toLowerCase() === 'product';
};

/**
 * The product a URL names in its Product parameter.
 *
 * @param {string} url the URL
 * @returns {string | undefined} the first product named, an empty string
 * where each Product parameter is empty, or undefined where the URL has
 * none
 */
const productInUrl = function (url) {
  const query = url ? queryOf(url) : undefined;
  if (!query) {
    return undefined;
  }
  let product;
  for (const parameter of query.parameters) {
    if (isProduct(parameter)) {
      const value = querystring.unescape(
        parameter.substring(parameter.indexOf('=') + 1).replace(/\+/g, ' '));
      if (parameter.includes('=') && value !== '') {
        return value;
      }
      product = '';
    }
  }
  return product;
};

/**
 * A URL with its Product parameters taken out. The rest of the URL is kept
 * as it is written.
 *
 * @param {string} url the URL
 * @returns {string} the URL with no Product parameter
 */
const withoutProduct = function (url) {
  const query = queryOf(url);
  const kept = query.parameters.filter((parameter) => !isProduct(parameter));
  return url.substring(0, query.start) +
    (kept.length > 0 ? '?' + kept.join('&') : '') +
    url.substring(query.end);
};

/**
 * Instance of DataFile class for the IP Intelligence Engine
 * Extends datafile by providing a formatter for the DataFileUpdateService
 * update url which contains the type and licensekeys.
 * These parameters are passed in to the datafile constructor's
 * updateURLParams parameter
 **/
class IpIntelligenceDataFile extends DataFile {
  /**
   * Constructor for IP Intelligence DataFile
   *
   * @param {object} options options for the datafile
   * @param {string} options.useUrlFormatter whether to append default URL params for Data File download
   * @param {function(string): string} [options.getProductFromFile] reads
   * the product name from the header of the data file at a path without
   * loading the file, and throws where it cannot
   **/
  constructor ({ useUrlFormatter = true, getProductFromFile, ...rest }) {
    super({ ...rest });
    this.useUrlFormatter = useUrlFormatter;
    this.getProductFromFile = getProductFromFile;
  }

  /**
   * Uses the type and licensekey parameters the datafile
   * was constructed with to generate a querystring used in the datafile
   * update service.
   *
   * The Product parameter is added only when a product is configured, and
   * then every request carries it, whether or not the default parameters
   * are added. With none configured the URL names no product, so license
   * keys that hold one product get its data file. A product named in the
   * base URL is the product asked for, and no other is added. Download=True
   * is added with the default parameters.
   *
   * @returns {string} url
   */
  urlFormatter () {
    const queryParams = {};
    let URL = this.updateURLParams.baseURL;
    let product = this.updateURLParams.product;

    // A product in the base URL is the product asked for, and an empty one
    // is no product.
    const named = productInUrl(URL);
    if (named) {
      product = undefined;
    } else if (named === '' && product) {
      URL = withoutProduct(URL);
    }

    if (product) {
      queryParams.Product = product;
    }
    queryParams.Type = this.updateURLParams.Type;
    queryParams.Download = 'True';

    if (this.updateURLParams.licenseKeys) {
      queryParams.licenseKeys = this.updateURLParams.licenseKeys;
    }

    if (this.useUrlFormatter) {
      URL += (URL.includes('?') ? '&' : '?') +
        querystring.stringify(queryParams);
    } else if (product) {
      URL += (URL.includes('?') ? '&' : '?') +
        querystring.stringify({ Product: product });
    }

    return URL;
  }

  /**
   * The name the Distributor gives the product of the data file, which is
   * 'IPIV4' and then the tier of the data file, so 'IPIV4Enterprise' for
   * the Enterprise data file. A tier that already starts that way is given
   * as it is, and 'IPIV4' alone is no product.
   * Once the engine has loaded a data file the tier comes from the engine.
   * Before then it is read from the header of the data file at the path,
   * without loading the file. It is empty where neither gives a tier, as
   * when there is no file at the path.
   *
   * @returns {string} the product name
   */
  getUpdateProduct () {
    const engine = this.flowElement && this.flowElement.engine;
    const tier = engine
      ? String(engine.getProduct() || '')
      : this.productInFile();
    if (tier === '' || tier.toUpperCase() === 'IPIV4') {
      return '';
    }
    return /^IPIV4/i.test(tier) ? tier : 'IPIV4' + tier;
  }

  /**
   * The product name in the header of the data file at the path, read
   * without loading the file.
   *
   * @returns {string} the product name, or an empty string where there is
   * no path, no way to read the header, or the header cannot be read
   */
  productInFile () {
    if (typeof this.getProductFromFile !== 'function' || !this.path) {
      return '';
    }
    try {
      return String(this.getProductFromFile(this.path) || '');
    } catch (e) {
      return '';
    }
  }
}

module.exports = IpIntelligenceDataFile;
