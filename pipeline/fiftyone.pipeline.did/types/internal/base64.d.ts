/**
 * The standard alphabet, padded form of base 64 written in either
 * alphabet. A 51Did is issued in the standard alphabet with padding, and a
 * page that puts one in a link uses the URL safe alphabet without it.
 * Every reader of a 51Did normalises through here.
 *
 * White space before and after the text is ignored. White space inside the
 * text, and a text holding a character from each alphabet such as both `+`
 * and `-`, give null, as the 51Did specification requires, because the
 * issuer writes neither and either is a sign of a damaged value.
 *
 * Written by hand because the package runs in a browser as well as in
 * Node. A browser has no `Buffer`, which reads both alphabets, and its
 * `atob` refuses the URL safe one. `Uint8Array.fromBase64` is in newer
 * browsers and not in Node 24. `atob` needs no padding, which is added
 * because `FodId.toStandardBase64` answers with the form the cloud issues.
 * @param {string} value base 64 in either alphabet, with or without padding
 * @returns {string|null} the standard alphabet form, padded, or null where
 * the text is refused
 */
export function toStandardBase64(value: string): string | null;
/**
 * The text without the white space before and after it. A loop, because a
 * regular expression anchored at the end takes time growing with the
 * square of the length of any run of white space inside the text.
 * @param {string} value the text
 * @returns {string} the text without white space at either end
 */
export function trimWhiteSpace(value: string): string;
