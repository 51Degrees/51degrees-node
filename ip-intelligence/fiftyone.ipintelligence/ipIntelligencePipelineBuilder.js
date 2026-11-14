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

const core = require('fiftyone.pipeline.core');
const IpIntelligenceOnPremise = require('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremise;
const IpIntelligenceCloud = require('fiftyone.ipintelligence.cloud').IpIntelligenceCloud;
const CloudRequestEngine = require('fiftyone.pipeline.cloudrequestengine').CloudRequestEngine;
const PipelineBuilder = core.PipelineBuilder;
const engines = require('fiftyone.pipeline.engines');
const LruCache = engines.LruCache;
const ShareUsageElement = require('fiftyone.pipeline.engines.fiftyone').ShareUsage;
const errorMessages = require('fiftyone.ipintelligence.shared').errorMessages;

class IpIntelligencePipelineBuilder extends PipelineBuilder {
  /**
   * Extension of pipelineBuilder class that allows for the quick
   * generation of an IP intelligence pipeline. Adds share usage,
   * caching and toggles between on premise and cloud with
   * simple parameter changes
   *
   * @param {object} options the options for the pipeline builder
   * @param {string} options.licenceKeys license key(s) used by the
   * data file update service. A key can be obtained from the
   * 51Degrees website: https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence-ipintelligencepipelinebuilder.js&utm_term=constructor.
   * A key is needed only when autoUpdate or updateOnStart is on with the
   * default dataUpdateUrl, and the engine refuses to build without one
   * then. The file system watcher needs no key.
   * @param {Array<string>|string} options.requestedProperties the fully
   * qualified names of the properties to ask the cloud service for, such
   * as ip.registeredcountry. Required with a license key and no resource key.
   * @param {string} options.resourceKey resourceKey, if using the
   * cloud engine
   * @param {string} options.dataFile dataFile path for the on premise engine
   * @param {boolean} options.autoUpdate whether to autoUpdate the dataFile
   * @param {number} options.pollingInterval How often to poll for
   * updates to the datafile (minutes)
   * @param {number} options.updateTimeMaximumRandomisation
   * Maximum randomisation offset in seconds to polling time interval
   * @param {boolean} options.fileSystemWatcher whether to monitor the datafile
   * path for changes
   * @param {boolean} options.updateOnStart whether to download / update a
   * dataFile to the path specified in options.dataFile on start
   * @param {boolean} options.shareUsage whether to include the share
   * usage element
   * @param {number} options.cacheSize size of the default cache
   * (includes cache if set). NOTE: This is not supported for on-premise
   * engine.
   * @param {Array} options.restrictedProperties This setting only affects
   * on-premise engines, not cloud.
   * list of properties the engine will be restricted to
   * @param {string} options.performanceProfile used to control the tradeoff
   * between performance and system memory usage (Only applies to on-premise,
   * not cloud) options are: LowMemory, MaxPerformance, Balanced,
   * BalancedTemp, HighPerformance
   * @param {string} options.cloudEndPoint This setting only affects
   * cloud engine, not on-premise.
   * Choose a non default endpoint for the cloud request engine
   * @param {string} options.cloudRequestOrigin This setting only affects
   * cloud engine, not on-premise.
   * Set the value to use for the Origin header when making requests to the
   * cloud service.
   *
   */
  constructor (
    {
      licenceKeys = null,
      dataFile = null,
      autoUpdate = true,
      fileSystemWatcher = true,
      pollingInterval = 30,
      updateTimeMaximumRandomisation = 10,
      shareUsage = true,
      resourceKey = null,
      requestedProperties = null,
      cacheSize = null,
      restrictedProperties,
      performanceProfile = 'Balanced',
      updateOnStart = false,
      cloudEndPoint = null,
      cloudRequestOrigin = null
    }) {
    super(...arguments);

    // Check if share usage enabled and add it to the pipeline if so

    if (shareUsage) {
      this.flowElements.push(new ShareUsageElement());
    }

    let cache;

    if (cacheSize) {
      cache = new LruCache({ size: cacheSize });
    }

    if (dataFile) {
      // Cache is not supported for on-premise engine.
      if (cacheSize) {
        throw errorMessages.cacheNotSupport;
      }

      this.flowElements.push(new IpIntelligenceOnPremise(
        {
          dataFilePath: dataFile,
          autoUpdate,
          fileSystemWatcher,
          pollingInterval,
          updateTimeMaximumRandomisation,
          licenceKeys,
          restrictedProperties,
          performanceProfile,
          updateOnStart
        }));
    } else {
      // First we need the cloudRequestEngine

      this.flowElements.push(new CloudRequestEngine(
        {
          resourceKey,
          licenseKey: licenceKeys,
          requestedProperties,
          baseURL: cloudEndPoint,
          cloudRequestOrigin,
          cache
        }));

      // Then add the cloud IP intelligence engine

      this.flowElements.push(new IpIntelligenceCloud());
    }
  }
}

module.exports = IpIntelligencePipelineBuilder;
