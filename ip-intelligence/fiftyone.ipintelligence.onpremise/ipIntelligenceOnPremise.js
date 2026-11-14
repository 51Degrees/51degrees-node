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
const engines = require('fiftyone.pipeline.engines');

const Engine = engines.Engine;
const AutoUpdateStatus = engines.AutoUpdateStatus;
const DataFile = require('./ipIntelligenceDataFile');
const SwigData = require('./swigData');
const swigHelpers = require('./swigHelpers');
const errorMessages = require('fiftyone.ipintelligence.shared').errorMessages;
const os = require('os');
const path = require('path');
const EvidenceKeyFilter = core.BasicListEvidenceKeyFilter;
const AnyEvidenceKeyFilter = core.EvidenceKeyFilter;
const fs = require('fs');
const util = require('util');
const constants = require('./constants');
const Component = require('./component');
const Property = require('./property');
const Profile = require('./profile');

/**
 * @typedef {import('fiftyone.pipeline.engines').DataKeyedCache} DataKeyedCache
 */

/**
 * @typedef {import('fiftyone.pipeline.engines').Engine} Engine
 */

/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 */

// Determine if Windows or linux and which node version

const nodeVersion = Number(process.version.match(/^v(\d+\.)/)[1]);

// Private method to init properties.
// This should only be called by the call() method with an input for 'this'
// object.
const initProperties = function (metadata) {
  const propertiesInternal = metadata.getProperties();

  const properties = {};

  for (let i = 0; i < propertiesInternal.getSize(); i++) {
    const property = propertiesInternal.getByIndex(i);
    if (property.getAvailable()) {
      properties[property.getName().toLowerCase()] =
        new Property(property, metadata);
    }
  };

  this.properties = properties;
};

// Private method to init components
// This should only be called by the call() method with an input for 'this'
// object.
const initComponents = function (metadata) {
  // Get components list
  const componentsInternal = metadata.getComponents();

  const components = {};

  for (let i = 0; i < componentsInternal.getSize(); i++) {
    const component = componentsInternal.getByIndex(i);
    components[component.getName().toLowerCase()] =
      new Component(component, metadata);
  }

  this.components = components;
};

/**
 * On premise version of the 51Degrees IP Intelligence Engine
 * Uses a data file to process evidence in FlowData and create results
 * This datafile can automatically update when a new version is available
 **/
class IpIntelligenceOnPremise extends Engine {
  /**
   * Constructor for IP Intelligence On Premise engine
   *
   * @param {object} options options for the engine
   * @param {string} options.dataFilePath path to the datafile
   * @param {boolean} options.autoUpdate whether the datafile
   * should be registered with the data file update service
   * @param {number} options.pollingInterval How often to poll for
   * updates to the datafile (minutes)
   * @param {number} options.updateTimeMaximumRandomisation
   * Maximum randomisation offset in seconds to polling time interval
   * @param {DataKeyedCache} options.cache an instance of the Cache class from
   * Fiftyone.Pipeline.Engines. NOTE: This is not supported for
   * on-premise engine.
   * @param {string} options.dataUpdateUrl base url for the datafile
   * update service
   * @param {boolean} options.dataUpdateVerifyMd5 whether to check MD5 of datafile
   * @param {boolean} options.dataUpdateUseUrlFormatter whether to append default URL params for Data File download
   * @param {Array<string>} options.restrictedProperties list of properties the engine
   * will be restricted to
   * @param {string} options.licenceKeys license key(s) used by the
   * data file update service. A key can be obtained from the
   * 51Degrees website: https://51degrees.com/pricing?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.ipintelligence.onpremise-ipintelligenceonpremise.js&utm_term=constructor.
   * If you do not wish to use a key then you can specify
   * an empty string, but this will cause automatic updates to
   * be disabled.
   * @param {boolean} options.download whether to download the datafile
   * or store it in memory
   * @param {string} options.performanceProfile options are:
   * LowMemory, MaxPerformance, Balanced, BalancedTemp, HighPerformance
   * @param {boolean} options.fileSystemWatcher whether to monitor the datafile
   * path for changes
   * @param {number} options.concurrency defaults to the number of cpus
   * in the machine
   * @param {boolean} options.reuseTempFile Indicates that an existing temp
   * file may be used. This should be selected if multiple instances wish to
   * use the same file to prevent high disk usage.
   * @param {boolean} options.createTempDataCopy If true, the engine will
   * create a copy of the data file in a temporary location
   * rather than using the file provided directly. If not
   * loading all data into memory, this is required for
   * automatic data updates to occur.
   * @param {string} options.tempDataDir The directory to use for the
   * temporary data copy if 'createTempDataCopy' is set to true.
   * @param {boolean} options.updateOnStart whether to download / update
   * the datafile on initialisation. If there is no file at dataFilePath it
   * is downloaded, and processing fails if the download does not work.
   */
  constructor (
    {
      dataFilePath,
      autoUpdate,
      cache,
      dataUpdateUrl = constants.dataUpdateUrl,
      dataUpdateVerifyMd5 = true,
      dataUpdateUseUrlFormatter = true,
      restrictedProperties,
      licenceKeys,
      download,
      performanceProfile = 'Balanced',
      reuseTempFile = false,
      concurrency = os.cpus().length,
      fileSystemWatcher,
      pollingInterval,
      updateTimeMaximumRandomisation,
      createTempDataCopy,
      tempDataDir = os.tmpdir(),
      updateOnStart = false
    }) {
    let swigWrapper;
    let swigWrapperType;
    let dataFileType;

    if (typeof cache !== 'undefined') {
      throw errorMessages.cacheNotSupport;
    }

    if (typeof dataFilePath === 'undefined') {
      throw errorMessages.dataFilePathRequired;
    }
    // A file that is not there is downloaded when the engine updates on
    // start-up, so only an engine that cannot do so needs the file.
    const downloadsOnStart = updateOnStart && (
      dataUpdateUrl !== constants.dataUpdateUrl ||
      (licenceKeys && licenceKeys.length > 0));
    const fileMissing = fs.existsSync(dataFilePath) === false;
    if (fileMissing && !downloadsOnStart) {
      throw util.format(errorMessages.fileNotFound, dataFilePath);
    }
    // look at dataFile extension to detect type
    const ext = path.parse(dataFilePath).ext;

    if (ext === '.ipi') {
      // Ipi
      swigWrapperType = 'Ipi';
      const moduleDir = path.join(__dirname, 'build');
      const moduleName = path.join(moduleDir, `FiftyOneIpIntelligenceIpiV41-${os.platform()}-${process.arch}-${nodeVersion}.node`);

      // Check if the directory containing the native modules exists.
      if (fs.existsSync(moduleDir) === false) {
        throw util.format(errorMessages.moduleDirNotFound, moduleDir, moduleName);
      } else {
        // Try to load the native module for the current platform
        // and node version.
        try {
          swigWrapper = require(moduleName);
        } catch (err) {
          // Couldn't load the native module so we need to give the
          // user some information.
          const modules = {};
          // Go through all the available modules to build a list of
          // supported platform/Node version combinations.
          fs.readdirSync(moduleDir).forEach(file => {
            const parts = file.split(/-|\./);
            const plat = parts[1] === 'win32' ? 'windows' : parts[1];
            if (modules.hasOwnProperty(plat)) {
              modules[plat].push(parts[2]);
            } else {
              modules[plat] = [parts[2]];
            }
          });

          let availableModules = '';
          for (const platform in modules) {
            if (availableModules.length > 0) {
              availableModules = availableModules.concat(', ');
            }
            availableModules = availableModules.concat(platform +
              ' with Node versions: [' + modules[platform].sort().join(', ') + ']');
          }

          // Let the user know what's gone wrong.
          throw util.format(
            errorMessages.nativeModuleNotFound,
            moduleName,
            availableModules,
            err);
        }
      }
      // Matches the value returned by the native engine's getType
      // method, which is used by the distributor when checking for
      // a newer data file.
      dataFileType = 'IPIV41';
    } else {
      throw errorMessages.invalidFileExtension;
    }

    if (typeof licenceKeys === 'undefined') {
      throw errorMessages.licenseKeyRequired;
    }

    // Create vector for restricted properties
    const propertiesList = new swigWrapper.VectorStringSwig();

    if (restrictedProperties) {
      restrictedProperties.forEach(function (property) {
        propertiesList.add(property);
      });
    }

    const requiredProperties = new swigWrapper.RequiredPropertiesConfigSwig(propertiesList);

    const config = new swigWrapper['Config' + swigWrapperType + 'Swig']();

    switch (performanceProfile) {
      case 'LowMemory':
        config.setLowMemory();
        break;
      case 'MaxPerformance':
        config.setMaxPerformance();
        break;
      case 'Balanced':
        config.setBalanced();
        break;
      case 'BalancedTemp':
        config.setBalancedTemp();
        break;
      case 'HighPerformance':
        config.setHighPerformance();
        break;
      default:
        throw util.format(
          errorMessages.invalidPerformanceProfile,
          performanceProfile);
    }

    // If auto update is enabled then we must use a temporary copy of the file

    if (autoUpdate === true) {
      config.setUseTempFile(true);
    }

    if (createTempDataCopy === true) {
      config.setUseTempFile(true);
    }

    if (typeof tempDataDir === 'string') {
      const tempDirs = new swigWrapper.VectorStringSwig();
      tempDirs.add(tempDataDir);
      config.setTempDirectories(tempDirs);
    }

    config.setReuseTempFile(reuseTempFile);

    config.setConcurrency(concurrency);

    // This should always be set to 'false' for on-premise
    config.setUseUpperPrefixHeaders(false);

    super(...arguments);

    this.dataKey = 'ip';

    // The data file's keys are read when the engine is initialised,
    // which waits for the download when updateOnStart is set and there
    // is no file yet. Until then every key is kept, so evidence set
    // before then is not lost, and initEngine replaces this with the
    // keys the file lists.
    this.evidenceKeyFilter = new AnyEvidenceKeyFilter();

    const current = this;

    /**
     * Reads the Properties and components from the engine's data file, when
     * the engine is created and again each time the file reloads.
     */
    const readProperties = function () {
      const metadata = current.engine.getMetaData();
      initProperties.call(current, metadata);
      initComponents.call(current, metadata);
    };

    /**
     * Function for initialising the engine, wrapped like this so
     * that an engine can be initialised once the datafile is
     * retrieved if updateOnStart is set to true
     *
     * @returns {void}
     */
    this.initEngine = function () {
      const engine = new swigWrapper['Engine' + swigWrapperType + 'Swig'](dataFilePath, config, requiredProperties);

      // Get keys and add to evidenceKey filter

      const evidenceKeys = engine.getKeys();

      const evidenceKeyArray = [];

      for (let i = 0; i < evidenceKeys.size(); i += 1) {
        evidenceKeyArray.push(evidenceKeys.get(i).toLowerCase());
      }

      current.evidenceKeyFilter = new EvidenceKeyFilter(evidenceKeyArray);

      current.engine = engine;
      current.swigWrapper = swigWrapper;
      current.swigWrapperType = swigWrapperType;

      readProperties();
    };

    // Disable features that require a license key if one was
    // not supplied.
    if (dataUpdateUrl === constants.dataUpdateUrl) {
      if (licenceKeys) {
        autoUpdate = autoUpdate && licenceKeys.length > 0;
        updateOnStart = updateOnStart && licenceKeys.length > 0;
      } else {
        autoUpdate = false;
        updateOnStart = false;
      }
    }

    // Construct datafile
    const dataFileSettings = {
      flowElement: this,
      verifyMD5: dataUpdateVerifyMd5,
      autoUpdate,
      updateOnStart,
      decompress: true,
      path: dataFilePath,
      download,
      fileSystemWatcher,
      pollingInterval,
      updateTimeMaximumRandomisation,
      tempDataDirectory: tempDataDir,
      useUrlFormatter: dataUpdateUseUrlFormatter
    };

    // An engine with no data file yet has no published date, so the update
    // service falls back to the date of the file, if there is one.
    dataFileSettings.getDatePublished = function () {
      if (current.engine) {
        return swigHelpers.swigDateToDate(current.engine.getPublishedTime());
      }
      return undefined;
    };

    dataFileSettings.getNextUpdate = function () {
      if (current.engine) {
        return swigHelpers.swigDateToDate(current.engine.getUpdateAvailableTime());
      } else {
        return new Date();
      }
    };

    // The first refresh of an engine started without its data file
    // creates the engine from the file just downloaded.
    dataFileSettings.refresh = function () {
      if (current.engine) {
        current.engine.refreshData();
        // The reloaded file can hold other Properties than the one before,
        // for example the Enterprise data file after the Lite one.
        readProperties();
        current.updateProperties();
      } else {
        current.initEngine();
        current.startUpError = undefined;
        current.updateProperties();
      }
    };

    // An engine with no data file at all has nothing to process with if the
    // download fails.
    dataFileSettings.onUpdateComplete = function (status) {
      if (!current.engine && status !== AutoUpdateStatus.AUTO_UPDATE_SUCCESS) {
        current.startUpError = util.format(
          errorMessages.fileNotFoundNotDownloaded, dataFilePath, status);
      }
    };

    const params = {
      Type: dataFileType,
      Download: 'True'
    };

    if (licenceKeys) {
      params.licenseKeys = licenceKeys;
    }

    params.baseURL = dataUpdateUrl;

    dataFileSettings.updateURLParams = params;

    dataFileSettings.identifier = dataFileType;

    const ipiDatafile = new DataFile(dataFileSettings);

    if (!fileMissing) {
      this.initEngine();
    }

    this.registerDataFile(ipiDatafile);
  }

  * profiles () {
    const engineMetadata = this.engine.getMetaData();
    const profilesInternal = engineMetadata.getProfiles();
    for (let i = 0; i < profilesInternal.getSize(); i++) {
      yield new Profile(profilesInternal.getByIndex(i), engineMetadata);
    }
  }

  /**
   * Internal process method for IP Intelligence On Premise engine
   * Fetches the results from the SWIG wrapper into an instance of
   * the SwigData class which can be used to retrieve results from
   * the FlowData.
   *
   * @param {FlowData} flowData FlowData to process
   * @returns {Promise<void>} the result of processing
   **/
  processInternal (flowData) {
    const ipi = this;

    const process = function () {
      // set evidence

      const evidence = new ipi.swigWrapper.EvidenceIpiSwig();

      // Only the evidence the native engine reads is passed to it, as
      // the native evidence takes strings and other evidence may not be.
      const accepted = ipi.evidenceKeyFilter.filterEvidence(
        flowData.evidence.getAll());

      Object.entries(accepted).forEach(function ([key, value]) {
        evidence.set(key, value);
      });

      const result = ipi.engine.process(evidence);

      const data = new SwigData({ flowElement: ipi, swigResults: result });

      flowData.setElementData(data);
    };

    // Check if engine is initialised already

    if (this.engine) {
      process();
    } else {
      // wait until initialised

      return new Promise(function (resolve, reject) {
        const dataFileChecker = setInterval(function () {
          if (ipi.engine) {
            clearInterval(dataFileChecker);

            try {
              process();
              resolve();
            } catch (e) {
              reject(e);
            }
          } else if (ipi.startUpError) {
            clearInterval(dataFileChecker);

            reject(new Error(ipi.startUpError));
          }
        }, 500);
      });
    }
  }
}

module.exports = IpIntelligenceOnPremise;
