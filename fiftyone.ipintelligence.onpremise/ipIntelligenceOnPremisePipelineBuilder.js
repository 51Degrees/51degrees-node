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

const os = require('os');
const core = require('fiftyone.pipeline.core');
const IpIntelligenceOnPremise = require('./ipIntelligenceOnPremise');
const constants = require('./constants');
const PipelineBuilder = core.PipelineBuilder;
const ShareUsageElement = require('fiftyone.pipeline.engines.fiftyone').ShareUsage;
const errorMessages = require('fiftyone.ipintelligence.shared').errorMessages;

/**
 * @typedef {import('fiftyone.pipeline.engines').DataFileUpdateService} DataFileUpdateService
 */

class IpIntelligenceOnPremisePipelineBuilder extends PipelineBuilder {
  /**
   * Extension of pipelineBuilder class that allows for the quick
   * generation of an IP intelligence pipeline. Adds share usage and
   * an on-premise IP intelligence engine with simple parameter changes
   *
   * @param {object} options the options for the pipeline builder
   * @param {string} [options.licenceKeys] license key(s) used by the
   * data file update service. A key can be obtained from the
   * 51Degrees website: https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=ip-intelligence-node&utm_content=fiftyone.ipintelligence.onpremise-ipintelligenceonpremisepipelinebuilder.js&utm_term=constructor.
   * This parameter MUST be set when using a data file.
   * If you do not wish to use a key then you can specify
   * an empty string, but this will cause automatic updates
   * to be disabled.
   * @param {string} options.dataFile dataFile path for the on premise engine
   * @param {boolean} [options.dataUpdateVerifyMd5] whether to check MD5 of datafile
   * @param {boolean} [options.dataUpdateUseUrlFormatter] whether to append default URL params for Data File download
   * @param {boolean} [options.autoUpdate] whether to autoUpdate the dataFile
   * @param {string} [options.dataUpdateUrl] base url for the datafile
   * update service
   * @param {number} [options.pollingInterval] How often to poll for
   * updates to the datafile (minutes)
   * @param {number} [options.updateTimeMaximumRandomisation]
   * Maximum randomisation offset in seconds to polling time interval
   * @param {boolean} [options.shareUsage] whether to include the share
   * usage element
   * @param {boolean} [options.fileSystemWatcher] whether to monitor the datafile
   * path for changes
   * @param {boolean} [options.updateOnStart] whether to download / update a
   * dataFile to the path specified in options.dataFile on start
   * @param {number} [options.cacheSize] size of the default cache
   * (includes cache if set). NOTE: This is not supported for on-premise
   * engine.
   * @param {Array<string>} [options.restrictedProperties] list of properties the engine
   * will be restricted to
   * @param {string} [options.performanceProfile] used to control the tradeoff
   * between performance and system memory usage (Only applies to on-premise,
   * not cloud) options are: LowMemory, MaxPerformance, Balanced,
   * BalancedTemp, HighPerformance
   * @param {number} [options.concurrency] defaults to the number of cpus
   * in the machine
   * @param {boolean} [options.createTempDataCopy] If true, the engine will
   * create a copy of the data file in a temporary location
   * rather than using the file provided directly. If not
   * loading all data into memory, this is required for
   * automatic data updates to occur.
   * @param {string} [options.tempDataDir] The directory to use for the
   * temporary data copy if 'createTempDataCopy' is set to true.
   * @param {DataFileUpdateService} [options.dataFileUpdateService] Set
   * DataFileUpdateService so the datafiles can receive
   * automatic updates
   */
  constructor (
    {
      dataFileUpdateService = null,
      licenceKeys = null,
      dataFile = null,
      dataUpdateVerifyMd5 = true,
      dataUpdateUseUrlFormatter = true,
      autoUpdate = true,
      dataUpdateUrl = null,
      pollingInterval = 30,
      updateTimeMaximumRandomisation = 10,
      shareUsage = true,
      fileSystemWatcher = true,
      updateOnStart = false,
      cacheSize = null,
      restrictedProperties,
      performanceProfile = 'Balanced',
      concurrency = os.cpus().length,
      createTempDataCopy,
      tempDataDir
    }) {
    super(...arguments);

    // Check if share usage enabled and add it to the pipeline if so

    if (shareUsage) {
      this.flowElements.push(new ShareUsageElement());
    }

    if (dataUpdateUrl == null) {
      dataUpdateUrl = constants.dataUpdateUrl;
    }

    if (cacheSize) {
      throw errorMessages.cacheNotSupport;
    }
    this.flowElements.push(new IpIntelligenceOnPremise(
      {
        dataFilePath: dataFile,
        autoUpdate,
        dataUpdateUrl,
        dataUpdateVerifyMd5,
        dataUpdateUseUrlFormatter,
        fileSystemWatcher,
        pollingInterval,
        updateTimeMaximumRandomisation,
        licenceKeys,
        restrictedProperties,
        performanceProfile,
        concurrency,
        updateOnStart,
        createTempDataCopy,
        tempDataDir
      }));
  }
}

module.exports = IpIntelligenceOnPremisePipelineBuilder;
