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

/**
 * The error a request made by the {@link RequestClient} rejects with, when
 * the cloud service answers with a failure status or does not answer.
 */
class RequestClientError extends Error {
  /**
   * Constructor for Request Client Error
   *
   * @param {string} message error message
   * @param {object} response what the request got back
   * @param {object} [response.headers] the HTTP headers of the response, or
   * undefined when there was no response
   * @param {number} [response.statusCode] the HTTP status code of the
   * response, or undefined when there was no response
   * @param {string} response.content the content of the response, or the
   * reason the request failed when there was no response
   * @param {Error} [cause] the error that stopped the request, when there
   * was no response
   */
  constructor (message, { headers, statusCode, content }, cause) {
    super(message);
    this.name = this.constructor.name;
    if (cause !== undefined) {
      this.cause = cause;
    }
    this.headers = headers;
    this.statusCode = statusCode;
    this.content = content;
  }
}

module.exports = RequestClientError;
