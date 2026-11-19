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
  // The messages for a Property an Engine has that is missing from its
  // results, one for each reason, in the words of the specification's table.
  // Each is given the Property's name and the Engine's data key first.
  missingPropertyUpgrade: "Property '%s' not found in data for element " +
    "'%s'. This is because your license or data file does not include this " +
    'property. It is available with the %s license/data for the %s. To ' +
    'upgrade, see https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertyupgrade.',
  missingPropertyUpgradeNoTiers: "Property '%s' not found in data for " +
    "element '%s'. This is because your license or data file does not " +
    'include this property. To see which licenses include it, see https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertyupgradenotiers.',
  missingPropertyExcluded: "Property '%s' not found in data for element " +
    "'%s'. This is because the property has been excluded when configuring " +
    'the engine.',
  missingPropertyProduct: "Property '%s' not found in data for element " +
    "'%s'. This is because your resource key does not include access to any " +
    "properties under '%s'. Check or create a resource key with the " +
    'properties you need on the configuration page at https://51degrees.com/configure?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertyproduct.',
  missingPropertyNotIncluded: "Property '%s' not found in data for element " +
    "'%s'. This is because your resource key does not include access to " +
    "this property. The properties included for your key under '%s' are %s. " +
    'Check or change your key on the configuration page at https://51degrees.com/configure?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=missingpropertynotincluded.',
  missingPropertyCloudRequestFailed: "Property '%s' not found in data for " +
    "element '%s'. This is because an upstream cloud request failed, so no " +
    'data was available to populate the property.',
  missingPropertyUnknown: "Property '%s' not found in data for element " +
    "'%s'. The reason for this is unknown. Please check that the aspect and " +
    'property name are correct.',
  /**
   * @deprecated No longer used. missingPropertyProduct replaces it.
   */
  cloudNoPropertiesAccess: ' This is because your resource key does not ' +
    'include access to any properties under "%s". For more details, see our ' +
    'resource key explainer: ' +
    'https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=cloudnopropertiesaccess',
  /**
   * @deprecated No longer used. missingPropertyNotIncluded replaces it.
   */
  cloudNoPropertyAccess: ' This is because your resource key does not ' +
    'include access to this property. Properties that are included for this ' +
    'key under "%s" are %s. For more details on resource keys, see our ' +
    'explainer: ' +
    'https://51degrees.com/documentation/_services__cloud__resource_keys.html?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.engines-errormessages.js&utm_term=cloudnopropertyaccess',
  /**
   * @deprecated No longer used. A Property the metadata lists is
   * missingPropertyExcluded.
   */
  cloudReasonUnknown: ' The reason for this is unknown as the supplied ' +
    'resource key does appear to allow access to this property.',
  /**
   * @deprecated No longer used. missingPropertyExcluded replaces it.
   */
  propertyExcluded: 'Property "%s" is not present in the results. This ' +
    'is because the property has been excluded when configuring the engine.'
};
