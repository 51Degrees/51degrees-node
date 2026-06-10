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

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(path.join(__dirname, '/../../', requestedPackage));
  }
};

const FiftyOneDegreesIpIntelligenceOnPremise = require51('fiftyone.ipintelligence.onpremise');
const EngineBuilder = require51('fiftyone.ipintelligence.onpremise').IpIntelligenceOnPremise;

const http = require('http');
let server;

const HTTP_PORT = 8080;
const DataFile = path.resolve((process.env.directory || __dirname) + '/../ip-intelligence-cxx/ip-intelligence-data/51Degrees-LiteV41.ipi');

describe('ipIntelligenceOnPremise', () => {
  // Check that an exception is thrown if license key is not
  // specified when creating an on-premise engine.
  test('License key required', () => {
    const test = () => {
      return new EngineBuilder({
        dataFilePath: DataFile
      });
    };
    expect(test).toThrow(/^license key is required/);
  });

  // Check that an empty license key can be specified.
  // Also verify that this will cause auto update and
  // update on startup to be disabled.
  test('License key can be empty', done => {
    const engine = new EngineBuilder({
      dataFilePath: DataFile,
      licenceKeys: ''
    });

    const fakePipeline = {
      dataFileUpdateService: {
        registerDataFile: function (dataFileConfig) {
          // No license key so auto update and update on startup
          // should be disabled.
          expect(dataFileConfig.autoUpdate).toBe(false);
          expect(dataFileConfig.updateOnStart).toBe(false);
        }
      }
    };
    engine.registrationCallbacks[0](fakePipeline);

    done();
  });

  // Check that the license key is passed through correctly
  // if it is set.
  test('License key set', done => {
    const engine = new EngineBuilder({
      dataFilePath: DataFile,
      licenceKeys: 'ABC',
      autoUpdate: true,
      updateOnStart: true
    });

    const fakePipeline = {
      dataFileUpdateService: {
        registerDataFile: function (dataFileConfig) {
          expect(dataFileConfig.autoUpdate).toBe(true);
          expect(dataFileConfig.updateOnStart).toBe(true);
          expect(dataFileConfig.updateURLParams.licenseKeys).toBe('ABC');
        }
      }
    };
    engine.registrationCallbacks[0](fakePipeline);

    done();
  });

  // Check that if no evidence is provided for the IP intelligence
  // engine, accessing a valid property will return HasValue=false
  test('No evidence error message', done => {
    const pipeline = new FiftyOneDegreesIpIntelligenceOnPremise
      .IpIntelligenceOnPremisePipelineBuilder({
        performanceProfile: 'Balanced',
        dataFile: DataFile,
        autoUpdate: false,
        shareUsage: false
      }).build();
    const flowData = pipeline.createFlowData();

    flowData.process().then(function () {
      const registeredName = flowData.ip.registeredname;
      expect(registeredName.hasValue).toBe(false);
      expect(registeredName.noValueMessage.length).toBeGreaterThan(0);

      done();
    });
  });

  // Check that setting cache for on-premise engine will
  // throw exception
  test('No cache support for on-premise engine builder', done => {
    try {
      const engine = new EngineBuilder({
        dataFilePath: DataFile,
        cache: 100
      });
      console.log(engine); // to prevent linter error
    } catch (err) {
      expect(err.indexOf('cache cannot be configured') !== -1).toBe(true);

      done();
    }
  });

  // Check that setting cache for on-premise engine builder will
  // throw exception
  test('No cache support for on-premise engine', done => {
    try {
      new FiftyOneDegreesIpIntelligenceOnPremise
        .IpIntelligenceOnPremisePipelineBuilder({
          dataFile: DataFile,
          cacheSize: 100
        }).build();
    } catch (err) {
      expect(err.indexOf('cache cannot be configured') !== -1).toBe(true);

      done();
    }
  });

  // Check if components are set correctly
  test('Components for on-premise engine', done => {
    const pipeline = new FiftyOneDegreesIpIntelligenceOnPremise
      .IpIntelligenceOnPremisePipelineBuilder({
        dataFile: DataFile,
        shareUsage: false
      }).build();
    const ip = pipeline.getElement('ip');
    expect(Object.entries(ip.components).length).toBeGreaterThan(0);
    for (const component of Object.values(ip.components)) {
      const properties = component.getProperties();
      for (const property of properties) {
        expect(property.component.name).toBe(component.name);
      }
    }
    done();
  });

  // Check if properties are set correctly
  test('Properties for on-premise engine', done => {
    const pipeline = new FiftyOneDegreesIpIntelligenceOnPremise
      .IpIntelligenceOnPremisePipelineBuilder({
        dataFile: DataFile,
        shareUsage: false
      }).build();
    const ip = pipeline.getElement('ip');
    expect(Object.entries(ip.properties).length).toBeGreaterThan(0);
    done();
  });

  // Check that profiles can be iterated
  test('profiles for on-premise engine', done => {
    const pipeline = new FiftyOneDegreesIpIntelligenceOnPremise
      .IpIntelligenceOnPremisePipelineBuilder({
        dataFile: DataFile,
        shareUsage: false
      }).build();
    const ip = pipeline.getElement('ip');
    const profiles = ip.profiles();
    let count = 0;
    while (profiles.next() !== undefined && count < 20) {
      count++;
    }

    expect(count).toBe(20);
    done();
  });

  // Check that the evidence key filter contains the expected
  // client IP keys.
  test('key filter has client IP keys', done => {
    const pipeline = new FiftyOneDegreesIpIntelligenceOnPremise
      .IpIntelligenceOnPremisePipelineBuilder({
        dataFile: DataFile,
        shareUsage: false
      }).build();
    const ipKeyFilter = pipeline.getElement('ip').evidenceKeyFilter.list;

    expect(ipKeyFilter.length).toBeGreaterThan(0);
    // At least one accepted evidence key should relate to
    // the client IP address.
    expect(ipKeyFilter.some(key => key.includes('client-ip'))).toBe(true);

    done();
  });

  // Engine should be initialized with a valid data file even if updateOnStart is set to true
  // and the server responds with a 304 status code (AUTO_UPDATE_NOT_NEEDED)
  test('Initialise engine with updateOnStart and 304 status code', done => {
    let requestsMade = 0;

    server = http.createServer((req, res) => {
      requestsMade++;
      res.writeHead(304);
      res.end();
    }).listen(HTTP_PORT);

    const pipeline = new FiftyOneDegreesIpIntelligenceOnPremise.IpIntelligenceOnPremisePipelineBuilder({
      dataFile: DataFile,
      updateOnStart: true,
      autoUpdate: true,
      shareUsage: false,
      dataUpdateUrl: `http://localhost:${HTTP_PORT}/temp`,
      dataUpdateVerifyMd5: false,
      dataUpdateUseUrlFormatter: false,
      createTempDataCopy: true,
      tempDataDir: './tests/tmp'
    }).build();

    pipeline.on('error', console.error);
    pipeline.on('info', console.info);

    const tryForRequestInterval = setInterval(() => {
      if (requestsMade > 0) {
        clearInterval(tryForRequestInterval);
        setTimeout(() => {
          expect(pipeline.flowElements.ip.engine).toBeDefined();
          done();
        }, 200);
      }
    }, 100);
  }, 30000);
});

afterEach(() => {
  if (server && !server.closed) {
    server.close();
  }
});
