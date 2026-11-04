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

// The callback URL the client script posts to for updated JSON. The protocol
// and host usually come from the request, and the script holds the URL in a
// single-quoted string, so the URL is checked before it is written into the
// script. A URL that is not valid is refused. In the user information, in
// anything after the host and port, and in the endpoint, the characters a
// URL cannot hold or that could end the string or the script are
// percent-encoded. See
// https://github.com/51Degrees/specifications/blob/main/pipeline-specification/pipeline-elements/javascript-builder.md#callback-url

// The largest port number.
const maxPort = 65535;

// The most digits a port can have once its leading zeros are dropped.
const maxPortDigits = 5;

// The printable ASCII characters that are percent-encoded, besides the
// control characters, the space and everything outside ASCII.
const encodedCharacters = '"\'<>\\^`{|}';

// Text made only of the Unicode White_Space characters, which counts as a
// part that is not set. The first range is tab, line feed, vertical tab,
// form feed and carriage return.
const blankPattern =
  /^[\t-\r \u0085\u00a0\u1680\u2000-\u200a\u2028\u2029\u202f\u205f\u3000]*$/;

// A scheme as RFC 3986 section 3.1 defines one, being a letter followed by
// letters, digits, '+', '-' and '.'.
const schemePattern = /^[A-Za-z][A-Za-z0-9+.-]*$/;

// A label of a host name, being ASCII letters, digits, '-' and '_'.
const labelPattern = /^[A-Za-z0-9_-]+$/;

// An IPv6 zone identifier, being unreserved characters as RFC 3986 section
// 2.3 defines them.
const zonePattern = /^[A-Za-z0-9._~-]+$/;

// A port as it follows the host, being ':' and any number of digits.
const portPattern = /^:[0-9]*$/;

// One group of an IPv6 address.
const hexGroupPattern = /^[0-9A-Fa-f]{1,4}$/;

// An IPv4 address as RFC 3986 section 3.2.2 defines one, being four numbers
// from 0 to 255 with no leading zeros.
const decOctet = '(25[0-5]|2[0-4][0-9]|1[0-9]{2}|[1-9]?[0-9])';
const ipv4Pattern = new RegExp('^' + decOctet + '(\\.' + decOctet + '){3}$');

/**
 * Whether a part of the URL is not set, being anything other than a string,
 * or a string that is empty or only whitespace.
 *
 * @param {*} text the part
 * @returns {boolean} true if the part is not set
 */
function isBlank (text) {
  return typeof text !== 'string' || blankPattern.test(text);
}

/**
 * Where the authority ends, which is at the first '/', '?' or '#' of the
 * host, or at its end.
 *
 * @param {string} host the host
 * @returns {number} the index the authority ends at
 */
function authorityEnd (host) {
  const end = host.search(/[/?#]/);
  return end === -1 ? host.length : end;
}

/**
 * Whether a byte is an ASCII hexadecimal digit.
 *
 * @param {number} b the byte
 * @returns {boolean} true if the byte is an ASCII hexadecimal digit
 */
function isHexDigit (b) {
  return (b >= 0x30 && b <= 0x39) ||
    (b >= 0x41 && b <= 0x46) ||
    (b >= 0x61 && b <= 0x66);
}

/**
 * The text with each byte of its UTF-8 encoding percent-encoded where the
 * byte is a control character, a space, outside ASCII or one of
 * encodedCharacters, and with a '%' encoded where two hexadecimal digits do
 * not follow it. A lone surrogate has no UTF-8 encoding, and Node writes it
 * as U+FFFD, as a browser does.
 *
 * @param {string} text the text to encode
 * @returns {string} the encoded text
 */
function encoded (text) {
  const bytes = Buffer.from(text, 'utf8');
  let out = '';
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    const keep = b === 0x25
      ? i + 2 < bytes.length &&
        isHexDigit(bytes[i + 1]) &&
        isHexDigit(bytes[i + 2])
      : b > 0x20 && b < 0x7f &&
        encodedCharacters.indexOf(String.fromCharCode(b)) === -1;
    out += keep
      ? String.fromCharCode(b)
      : '%' + b.toString(16).toUpperCase().padStart(2, '0');
  }
  return out;
}

/**
 * The number of 16 bit groups in a run of groups separated by ':', or -1
 * when the run is not valid. An empty run has none, and an IPv4 address at
 * the end of the run, where one is allowed, counts as two.
 *
 * @param {string} run the groups
 * @param {boolean} ipv4AtEnd whether the run can end with an IPv4 address
 * @returns {number} the number of groups, or -1
 */
function groups (run, ipv4AtEnd) {
  if (run === '') {
    return 0;
  }
  const parts = run.split(':');
  let count = 0;
  for (let i = 0; i < parts.length; i++) {
    if (hexGroupPattern.test(parts[i])) {
      count++;
    } else if (ipv4AtEnd &&
      i === parts.length - 1 &&
      ipv4Pattern.test(parts[i])) {
      count += 2;
    } else {
      return -1;
    }
  }
  return count;
}

/**
 * Whether the text is an IPv6 address as RFC 3986 section 3.2.2 defines one.
 * That is eight groups of one to four hexadecimal digits separated by ':',
 * where one '::' can stand for one or more groups of zeros and the last two
 * groups can be written as an IPv4 address.
 *
 * @param {string} text the address, without its brackets
 * @returns {boolean} true if the text is an IPv6 address
 */
function isIpv6 (text) {
  const gap = text.indexOf('::');
  if (gap === -1) {
    return groups(text, true) === 8;
  }
  if (text.indexOf('::', gap + 1) !== -1) {
    return false;
  }
  const head = groups(text.substring(0, gap), false);
  const tail = groups(text.substring(gap + 2), true);
  return head >= 0 && tail >= 0 && head + tail <= 7;
}

/**
 * Whether the text is ':' followed by digits whose value is no more than
 * 65535, or by nothing.
 *
 * @param {string} text the port, with its ':'
 * @returns {boolean} true if the text is a port
 */
function isPort (text) {
  if (!portPattern.test(text)) {
    return false;
  }
  const digits = text.substring(1).replace(/^0+/, '');
  return digits.length <= maxPortDigits &&
    (digits === '' || Number(digits) <= maxPort);
}

/**
 * The host and optional port in lower case, or null when they are not
 * valid. The host is an IPv6 address in brackets with an optional zone
 * identifier, or a name of labels separated by dots with a dot allowed at
 * the end. The port is ':' followed by digits up to 65535, or by nothing.
 *
 * @param {string} hostPort the host and port
 * @returns {string|null} the host and port, or null
 */
function checkedHostPort (hostPort) {
  let host;
  let port;
  if (hostPort.startsWith('[')) {
    const close = hostPort.indexOf(']');
    if (close === -1) {
      return null;
    }
    let address = hostPort.substring(1, close);
    const zone = address.indexOf('%25');
    if (zone !== -1) {
      if (!zonePattern.test(address.substring(zone + 3))) {
        return null;
      }
      address = address.substring(0, zone);
    }
    if (!isIpv6(address)) {
      return null;
    }
    host = hostPort.substring(0, close + 1);
    port = hostPort.substring(close + 1);
  } else {
    const colon = hostPort.indexOf(':');
    const end = colon === -1 ? hostPort.length : colon;
    host = hostPort.substring(0, end);
    port = hostPort.substring(end);
    const name = host.endsWith('.') ? host.slice(0, -1) : host;
    if (!name.split('.').every(label => labelPattern.test(label))) {
      return null;
    }
  }
  if (port !== '' && !isPort(port)) {
    return null;
  }
  return host.toLowerCase() + port;
}

/**
 * The user information, host and port as they are written into the URL, or
 * null when they are not valid. The user information ends at the first
 * '@', so a second '@' is part of the host and refused.
 *
 * @param {string} authority the authority
 * @returns {string|null} the authority, or null
 */
function checkedAuthority (authority) {
  const at = authority.indexOf('@');
  if (at === -1) {
    return checkedHostPort(authority);
  }
  const hostPort = checkedHostPort(authority.substring(at + 1));
  return hostPort === null
    ? null
    : encoded(authority.substring(0, at)) + '@' + hostPort;
}

/**
 * Builds the callback URL from its parts and checks it. One slash separates
 * the host and the endpoint, being added when neither has one and removed
 * when both do. The protocol and the host are written in lower case and the
 * rest as given, apart from the percent-encoding.
 *
 * @param {*} protocol the protocol, such as https
 * @param {*} host the host, which can start with user information and end
 * with a port, a path, a query or a fragment
 * @param {*} endPoint the endpoint
 * @returns {{valid: boolean, url: string}|null} null when the protocol,
 * host or endpoint is not set. Otherwise whether the URL is valid, and the
 * URL to write into the script when it is, or the URL as it was built, for
 * the log, when it is not.
 */
function callbackUrl (protocol, host, endPoint) {
  if (isBlank(protocol) || isBlank(host) || isBlank(endPoint)) {
    return null;
  }
  const hostHasSlash = host.endsWith('/');
  const endPointHasSlash = endPoint.startsWith('/');
  if (hostHasSlash === false && endPointHasSlash === false) {
    endPoint = '/' + endPoint;
  } else if (hostHasSlash && endPointHasSlash) {
    endPoint = endPoint.substring(1);
  }
  const built = protocol + '://' + host + endPoint;
  if (!schemePattern.test(protocol)) {
    return { valid: false, url: built };
  }
  const end = authorityEnd(host);
  const authority = checkedAuthority(host.substring(0, end));
  if (authority === null) {
    return { valid: false, url: built };
  }
  return {
    valid: true,
    url: protocol.toLowerCase() + '://' + authority +
      encoded(host.substring(end)) + encoded(endPoint)
  };
}

module.exports = callbackUrl;
