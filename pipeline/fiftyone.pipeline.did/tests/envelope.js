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

// Builders for OWID envelopes carrying a 51Did payload, shared by the
// tests. Envelopes are built byte for byte (version, domain, date, payload
// length, payload, 64 byte signature), matching owid-js getByteArray plus
// the signature, and signed with real ECDSA P-256 keys where a test needs
// a signature that verifies.

const layout = require('../internal/layout');

const VERSION = 2;
const SIGNED_VERSION = 3;
const DOMAIN = '51degrees.com';
const DATE = 2900000; // minutes since 2020-01-01
// HashedEmail type tag in bits 6-7, payload version 0 in bits 4-5 and
// the personalized marketing usage in bits 0-2.
const CANONICAL_FLAGS = 0x85;
// The terms index a marketing identifier carries, being the Model Terms
// for Marketing version 2, and the zero a non-marketing one carries.
const MARKETING_TERMS_INDEX = 1;
const NON_MARKETING_TERMS_INDEX = 0;
const CANONICAL_LICENSE_ID = 0x12345678;
const OWID_EPOCH_MS = Date.UTC(2020, 0, 1);

/**
 * The canonical match key, each byte counting up from 0x20.
 *
 * @returns {Uint8Array} the match key
 */
function canonicalMatchKey () {
  const h = new Uint8Array(layout.MATCH_KEY_LENGTH);
  for (let i = 0; i < h.length; i++) { h[i] = 0x20 + i; }
  return h;
}

/**
 * Writes the canonical license id into the payload, little-endian.
 *
 * @param {Uint8Array} payload the payload to write to
 */
function writeLicenseId (payload) {
  // Little-endian 0x12345678 -> 78 56 34 12.
  payload[layout.LICENSE_ID_OFFSET] = 0x78;
  payload[layout.LICENSE_ID_OFFSET + 1] = 0x56;
  payload[layout.LICENSE_ID_OFFSET + 2] = 0x34;
  payload[layout.LICENSE_ID_OFFSET + 3] = 0x12;
}

/**
 * The canonical payload cut off at the end of the match key, so it carries
 * no terms byte. A reader takes that as a terms index of zero, and this is
 * the fixture for that rule rather than anything an issuer would write.
 *
 * @returns {Uint8Array} the payload
 */
function payloadEndingAtMatchKey () {
  const p = new Uint8Array(layout.PAYLOAD_LENGTH);
  p[layout.FLAGS_OFFSET] = CANONICAL_FLAGS;
  writeLicenseId(p);
  p.set(canonicalMatchKey(), layout.MATCH_KEY_OFFSET);
  return p;
}

/**
 * The canonical payload as an issuer writes one, carrying the payload
 * version 0 in its flags byte and the terms byte of the document a
 * personalized marketing identifier is created under. This is the creating
 * side, so it writes every field an issuer writes.
 *
 * @returns {Uint8Array} the payload
 */
function canonicalPayload () {
  return withTerms(payloadEndingAtMatchKey(), MARKETING_TERMS_INDEX);
}

/**
 * The canonical Random payload cut off at the end of its GUID.
 *
 * @returns {Uint8Array} the payload
 */
function randomPayloadEndingAtMatchKey () {
  const p = new Uint8Array(layout.RANDOM_PAYLOAD_LENGTH);
  p[layout.FLAGS_OFFSET] = (1 << 6) | 0b001; // Random tag + usage bits
  writeLicenseId(p);
  for (let i = 0; i < layout.GUID_LENGTH; i++) {
    p[layout.MATCH_KEY_OFFSET + i] = 0x40 + i;
  }
  return p;
}

/**
 * The canonical Random payload as an issuer writes one, carrying the zero
 * terms byte a non-marketing identifier carries.
 *
 * @returns {Uint8Array} the payload
 */
function canonicalRandomPayload () {
  return withTerms(
    randomPayloadEndingAtMatchKey(), NON_MARKETING_TERMS_INDEX);
}

/**
 * The same payload with its version bits set to the given version, leaving
 * every other bit of the flags byte alone.
 *
 * @param {Uint8Array} payload the payload to copy
 * @param {number} version the payload version, 0 to 3
 * @returns {Uint8Array} the copy with the new version
 */
function withPayloadVersion (payload, version) {
  const p = payload.slice();
  p[layout.FLAGS_OFFSET] =
    (payload[layout.FLAGS_OFFSET] & 0b11001111) | (version << 4);
  return p;
}

/**
 * The same payload with a terms byte written after the match key, and a
 * creator context section of contextLength bytes after that where one is
 * asked for. The payload given must end at the match key, as both the
 * canonical builders above do, so that the byte lands at the offset a
 * reader works out from the identifier type.
 *
 * @param {Uint8Array} payload the payload, ending at the match key
 * @param {number} index the terms index to write
 * @param {number} [contextLength] the length of the creator context section, or 0 for none
 * @returns {Uint8Array} the longer payload
 */
function withTerms (payload, index, contextLength = 0) {
  const p = new Uint8Array(
    payload.length + layout.TERMS_LENGTH + contextLength);
  p.set(payload);
  p[payload.length] = index;
  if (contextLength > 0) {
    p.fill(0xCC, payload.length + layout.TERMS_LENGTH);
  }
  return p;
}

/**
 * The four bytes of an unsigned 32-bit value, little-endian.
 *
 * @param {number} v the value
 * @returns {number[]} the bytes, least significant first
 */
function uint32LE (v) {
  return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF];
}

/**
 * The bytes the signature covers: everything before the signature.
 *
 * @param {Uint8Array} payload the payload
 * @param {number} date the OWID date in minutes since 2020-01-01
 * @param {number} [version] the OWID version
 * @param {string} [domain] the creator domain
 * @returns {Uint8Array} the bytes before the signature
 */
function noSigBytes (payload, date, version = VERSION, domain = DOMAIN) {
  const out = [version];
  for (let i = 0; i < domain.length; i++) { out.push(domain.charCodeAt(i)); }
  out.push(0);
  out.push(...uint32LE(date));
  out.push(...uint32LE(payload.length));
  for (const b of payload) { out.push(b); }
  return Uint8Array.from(out);
}

const DUMMY_SIG = (() => {
  const s = new Uint8Array(64);
  for (let i = 0; i < 64; i++) { s[i] = i + 1; }
  return s;
})();

/**
 * An envelope around the payload with the given fields,
 * and a dummy signature unless one is given.
 *
 * @param {Uint8Array} payload the payload
 * @param {object} [root0] the envelope fields
 * @param {number} [root0.date] the OWID date in minutes since 2020-01-01
 * @param {Uint8Array} [root0.signature] the signature bytes
 * @param {number} [root0.version] the OWID version
 * @param {string} [root0.domain] the creator domain
 * @returns {Uint8Array} the envelope bytes
 */
function envelopeBytes (payload, {
  date = DATE, signature = DUMMY_SIG, version = VERSION, domain = DOMAIN
} = {}) {
  const noSig = noSigBytes(payload, date, version, domain);
  const full = new Uint8Array(noSig.length + signature.length);
  full.set(noSig);
  full.set(signature, noSig.length);
  return full;
}

/**
 * An envelope around the payload, as standard base64.
 *
 * @param {Uint8Array} payload the payload
 * @param {object} [opts] the envelope fields, as envelopeBytes takes them
 * @returns {string} the envelope as base64
 */
function envelopeBase64 (payload, opts) {
  return Buffer.from(envelopeBytes(payload, opts)).toString('base64');
}

/**
 * DER bytes as a PEM block with the given label.
 *
 * @param {string} label the PEM label, such as PUBLIC KEY
 * @param {Uint8Array} der the DER bytes
 * @returns {string} the PEM text
 */
function toPem (label, der) {
  const b64 = Buffer.from(der).toString('base64');
  return `-----BEGIN ${label}-----\n${b64.match(/.{1,64}/g).join('\n')}\n` +
    `-----END ${label}-----\n`;
}

/**
 * A fresh ECDSA P-256 key pair that can sign and verify.
 *
 * @returns {Promise<CryptoKeyPair>} the key pair
 */
async function generateKeyPair () {
  return crypto.subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
}

/**
 * The public key of a key pair as PEM.
 *
 * @param {CryptoKeyPair} keyPair the key pair
 * @returns {Promise<string>} the public key PEM
 */
async function publicPemOf (keyPair) {
  const spki = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  return toPem('PUBLIC KEY', new Uint8Array(spki));
}

/**
 * An envelope signed with the given key pair, as base64.
 *
 * @param {CryptoKeyPair} keyPair the key pair to sign with
 * @param {Uint8Array} payload the payload
 * @param {object} [root0] the envelope fields
 * @param {number} [root0.date] the OWID date in minutes since 2020-01-01
 * @param {number} [root0.version] the OWID version
 * @param {string} [root0.domain] the creator domain
 * @returns {Promise<string>} the signed envelope as base64
 */
async function signedWith (keyPair, payload, {
  date = DATE, version = SIGNED_VERSION, domain = DOMAIN
} = {}) {
  const noSig = noSigBytes(payload, date, version, domain);
  const sig = new Uint8Array(await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' }, keyPair.privateKey, noSig));
  const full = new Uint8Array(noSig.length + sig.length);
  full.set(noSig);
  full.set(sig, noSig.length);
  return Buffer.from(full).toString('base64');
}

/**
 * Real ECDSA P-256 signing via Web Crypto, with a fresh key pair, for the
 * verify tests.
 *
 * @param {Uint8Array} payload the payload
 * @param {number} [date] the OWID date in minutes since 2020-01-01
 * @param {number} [version] the OWID version
 * @returns {Promise<{base64: string, publicPem: string}>} the envelope and the public key that verifies it
 */
async function signedVerifiable (payload, date = DATE, version = VERSION) {
  const keyPair = await generateKeyPair();
  return {
    base64: await signedWith(keyPair, payload, { date, version }),
    publicPem: await publicPemOf(keyPair)
  };
}

/**
 * The public key of a fresh key pair as PEM, which verifies nothing signed here.
 *
 * @returns {Promise<string>} the public key PEM
 */
async function randomPublicPem () {
  return publicPemOf(await generateKeyPair());
}

/**
 * The OWID date field for a moment, in whole minutes since 2020-01-01.
 *
 * @param {Date} date the moment
 * @returns {number} the minutes since 2020-01-01
 */
function minutesOf (date) {
  return Math.floor((date.getTime() - OWID_EPOCH_MS) / 60000);
}

module.exports = {
  VERSION,
  SIGNED_VERSION,
  DOMAIN,
  DATE,
  CANONICAL_FLAGS,
  MARKETING_TERMS_INDEX,
  NON_MARKETING_TERMS_INDEX,
  CANONICAL_LICENSE_ID,
  DUMMY_SIG,
  canonicalMatchKey,
  canonicalPayload,
  canonicalRandomPayload,
  payloadEndingAtMatchKey,
  randomPayloadEndingAtMatchKey,
  withTerms,
  withPayloadVersion,
  noSigBytes,
  envelopeBytes,
  envelopeBase64,
  toPem,
  generateKeyPair,
  publicPemOf,
  signedWith,
  signedVerifiable,
  randomPublicPem,
  minutesOf
};
