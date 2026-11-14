export = callbackUrl;
/**
 * Builds the callback URL from its parts and checks it. One slash separates
 * the host and the endpoint, being added when neither has one and removed
 * when both do. The protocol and the host are written in lower case and the
 * rest as given, apart from the percent-encoding. The host value holds no
 * '?', '#' or '@'.
 *
 * @param {*} protocol the protocol, http or https in any case
 * @param {*} host the host, which can end with a port and a path
 * @param {*} endPoint the endpoint
 * @returns {{valid: boolean, url: string}|null} null when the protocol,
 * host or endpoint is not set. Otherwise whether the URL is valid, and the
 * URL to write into the script when it is, or the URL as it was built, for
 * the log, when it is not. The logged URL shows '***' in place of everything
 * in the host before its last '@'.
 */
declare function callbackUrl(protocol: any, host: any, endPoint: any): {
    valid: boolean;
    url: string;
} | null;
declare namespace callbackUrl {
    export { isScheme };
}
/**
 * Whether the protocol is http or https, ignoring the case of its ASCII
 * letters only.
 *
 * @param {string} protocol the protocol
 * @returns {boolean} true if the protocol is http or https
 */
declare function isScheme(protocol: string): boolean;
