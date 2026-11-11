/**
 * Masks the license keys in a log message or an error. Text is masked, and
 * so is all the text an error, an array or a plain object holds, including
 * an error's message, stack and other properties. A value that holds no key
 * is returned as it is. Anything else is returned unchanged. The value of
 * every license key parameter is masked, and each known key is masked
 * wherever it appears.
 *
 * @param {*} value a log message or error
 * @param {string|string[]} [keys] license keys to mask wherever they
 * appear. A value that holds several, separated by a comma or a bar, is
 * masked as each of them. A key of 4 characters or fewer is replaced
 * wherever those characters appear, even inside other words.
 * @returns {*} a copy of the value with each license key masked, or the
 * value itself when it holds no key
 */
export function mask(value: any, keys?: string | string[]): any;
