/**
 * Masks the license keys in a log message or an error. Text and the message
 * of an error are masked. An error that holds no key is returned as it is,
 * and anything else is returned unchanged.
 *
 * @param {*} value a log message or error
 * @returns {*} the value with each license key masked
 */
export function mask(value: any): any;
