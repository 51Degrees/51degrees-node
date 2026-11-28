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

module.exports = {
  // Thrown by newHumanConfidencePage when the engine has no resource key.
  humanConfidencePageNeedsResourceKey: 'CloudRequestEngine needs a ' +
    'resourceKey to start a Human Confidence page, because the page loads ' +
    'the 51Degrees client script with it. The license key stays on the ' +
    'server and is never put in a page.',
  // Thrown when a Pipeline holds the derived cloud engine and another
  // element that gives Element Data under the same key.
  derivedKeyTaken: 'DerivedCloudEngine gives its Element Data under ' +
    "'derived', and the Pipeline already holds %s under that key. One " +
    "Pipeline can hold one element for 'derived'. In a Pipeline that uses " +
    'the cloud, the cloud service gives HumanConfidence, so leave the ' +
    'DerivedPropertyElement out.',
  // Why HumanConfidence or HumanConfidenceSource has no value, on a request
  // that carries no sealed result, where the Pipeline has no Cloud Request
  // Engine. It is given the Property's name and the data key first, as the
  // missing property messages are.
  missingPropertyNoCloudRequestEngine: "Property '%s' not found in data " +
    "for element '%s'. This is because the Pipeline has no Cloud Request " +
    'Engine, so the property has a value only on a request that carries a ' +
    'sealed Human Confidence result in the evidence query.humanconfidence. ' +
    'Add a CloudRequestEngine before the DerivedCloudEngine to get the ' +
    'value from the cloud service.',
  // warning message to be shown for conflicted evidences
  evidenceConflict: "WARNING: '%s:%s' evidence conflicts with %s",
  // Refused when the engine is built, each saying why the cloud service
  // would refuse every request.
  noCredential: 'CloudRequestEngine needs a resourceKey or a licenseKey ' +
    'to authenticate with, as the cloud service answers 401 to a request ' +
    'that carries neither. Create a resource key for free at ' +
    'https://51degrees.com/configure?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.cloudrequestengine-errormessages.js&utm_term=no-credential',
  licenseKeyNeedsProperties: 'CloudRequestEngine has a licenseKey and no ' +
    'resourceKey or requestedProperties. A license key names no ' +
    'properties of its own, so the cloud service answers 400 to every ' +
    'request made with one that does not list the properties it wants. ' +
    'Set requestedProperties to the fully qualified names wanted, for ' +
    "example ['device.ismobile', 'device.iscrawler'].",
  // Logged as a warning when discovery got no answer or a 5xx when the
  // engine was built, followed by the errors.
  discoveryTriedAgain: 'The cloud service did not answer the Cloud ' +
    "Request Engine's discovery requests when the engine was built, so " +
    'they are tried again when it first processes. %s',
  // Logged once when, with a license key, an answer leaves out requested
  // properties.
  propertiesNotCovered: 'The cloud service did not return the ' +
    'requested properties %s. They are not covered by the keys in use, ' +
    'so they will be missing from every result. The other requested ' +
    'properties came back and are usable.',
  // Logged once when, with no license key, an answer leaves out
  // requested properties.
  propertiesNotProperties: 'The cloud service did not return the ' +
    'requested properties %s. They are not properties the cloud service ' +
    'knows, so they will be missing from every result. The other ' +
    'requested properties came back and are usable.',
  // logged when the cloud answer has no element for an engine's data key,
  // followed by productHintResourceKey or productHintLicenseKey
  elementMissing: "%s not populated. The cloud service left the '%s' " +
    'product out of the answer. The other products in the answer can ' +
    'still be used. %s',
  // logged when the element is null and the cloud gave no reason, followed
  // by productHintResourceKey or productHintLicenseKey
  elementNullNoReason: 'The cloud service gave no reason. %s',
  // how to check a product, where a resource key is in use
  productHintResourceKey: "To see whether the resource key includes the '%s' " +
    'product, open ' +
    'https://cloud.51degrees.com/api/v4/accessibleproperties?resource=<key>',
  // how to check a product, where a license key is used alone
  productHintLicenseKey: 'With a license key alone, the ' +
    'answer holds only the properties requestedProperties names that the ' +
    "license key includes, so check that requestedProperties names the '%s' " +
    'properties wanted and that the license key includes them.'
};
