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
 * Instance of DataFile class for the Device Detection Engine
 * Extends datafile by providing a formatter for the DataFileUpdateService
 * update url which contains the product, type and licensekeys.
 * These paramaters are passed in to the datafile constructor's
 * updateURLParams parameter
 **/
class DeviceDetectionDataFile extends DataFile {
  /**
   * Constructor for Device Detection DataFile
   *
   * @param {object} options options for the datafile
   * @param {string} options.useUrlFormatter whether to append default URL params for Data File download
   **/
  constructor ({ useUrlFormatter = true, ...rest }) {
    super({ ...rest });
    this.useUrlFormatter = useUrlFormatter;
  }

  /**
   * Uses the product, type and licensekey parameters the datafile
   * was constructed with to generate a querystring used in the datafile
   * update service.
   *
   * The Product parameter is added only when a product is configured, and
   * then every request carries it, whether or not the default parameters
   * are added. With none configured the URL names no product, so license
   * keys that hold one product get its data file.
   *
   * @returns {string} url
   */
  urlFormatter () {
    const product = this.updateURLParams.product;
    const queryParams = {};

    if (product) {
      queryParams.Product = product;
    }
    queryParams.Type = this.updateURLParams.Type;

    let URL = this.updateURLParams.baseURL;

    if (this.updateURLParams.licenseKeys) {
      queryParams.licenseKeys = this.updateURLParams.licenseKeys;
    }

    if (this.useUrlFormatter) {
      URL += '?' + querystring.stringify(queryParams);
    } else if (product) {
      URL += (URL.includes('?') ? '&' : '?') +
        querystring.stringify({ Product: product });
    }

    return URL;
  }

  /**
   * The name the Distributor gives the product of the data file the engine
   * has loaded, which is 'V4' and then the tier of the data file, so
   * 'V4TAC' for the TAC data file. A tier that already starts that way is
   * given as it is. It is empty where the engine has no data file yet.
   *
   * @returns {string} the product name
   */
  getUpdateProduct () {
    const engine = this.flowElement && this.flowElement.engine;
    const tier = engine ? String(engine.getProduct() || '') : '';
    if (tier === '') {
      return '';
    }
    return /^V4/i.test(tier) ? tier : 'V4' + tier;
  }
}

module.exports = DeviceDetectionDataFile;
