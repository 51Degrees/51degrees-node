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

// The pipeline compares property names ignoring case, so an engine built
// with names in the data set's own spelling gives each property under its
// lower case key, and a read finds a property whatever the letter case of
// the key it is given. Checked against the native engine and a real data
// file.

const path = require('path');
const require51 = (requestedPackage) => {
  try {
    return require(path.join(__dirname, '/../node_modules/', requestedPackage));
  } catch (e) {
    return require(requestedPackage);
  }
};

const core = require51('fiftyone.pipeline.core');
const EngineBuilder = require51(
  'fiftyone.devicedetection.onpremise').DeviceDetectionOnPremise;
const testHelper = require('./testHelper');
const SwigData = require(path.resolve(__dirname, '..', 'swigData'));

const dataFile = testHelper.getDataFilePath(testHelper.liteDataFileName);
const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) AppleWebKit/537' +
  '.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D167 Safari/9537.53';

const build = (restrictedProperties) => new EngineBuilder({
  dataFilePath: dataFile,
  licenceKeys: '',
  autoUpdate: false,
  restrictedProperties
});

// Processes one User-Agent and gives back the Flow Data. The Element Data
// throws for a property it does not hold, `then` included, so it is read
// from the Flow Data after the wait rather than given to a promise.
const processed = async (engine) => {
  const pipeline = new core.PipelineBuilder().add(engine).build();
  const flowData = pipeline.createFlowData();
  flowData.evidence.add('header.user-agent', mobileUserAgent);
  await flowData.process();
  return flowData;
};

// What a caller sees of a value, whether or not it has one.
const shown = (value) => value === undefined
  ? 'missing'
  : (value.hasValue
      ? 'value: ' + String(value.value)
      : 'no value: ' + value.noValueMessage);

describe('restricted property names with the native engine', () => {
  test('a read by name and a typed read give the same value', async () => {
    const data = (await processed(
      build(['IsMobile', 'BrowserName', 'PlatformName']))).device;
    const byName = data.get('ismobile');
    const typed = data.ismobile;
    expect(shown(typed)).toBe(shown(byName));
    // Both agree with the native engine asked by name directly.
    expect(String(byName.value))
      .toBe(String(data.swigResults.getValueAsBool('IsMobile').getValue()));
  });
});

describe('property names in any letter case with the native engine', () => {
  test('a read finds a property whatever the letter case of its key',
    async () => {
      const flowData = await processed(
        build(['IsMobile', 'BrowserName', 'PlatformName']));
      const data = flowData.device;
      const expected = shown(data.get('ismobile'));
      expect(expected).not.toBe('missing');
      expect(shown(data.get('IsMobile'))).toBe(expected);
      expect(shown(data.get('ISMOBILE'))).toBe(expected);
      expect(shown(data.IsMobile)).toBe(expected);
    });

  test('a read finds a match metric whatever the letter case of its key',
    async () => {
      // An engine with no names, so the match metrics are not refused.
      const data = (await processed(build(undefined))).device;
      const expected = shown(data.get('deviceID'));
      expect(expected).not.toBe('missing');
      expect(shown(data.get('deviceid'))).toBe(expected);
      expect(shown(data.get('DeviceId'))).toBe(expected);
      expect(shown(data.get('userAgents')))
        .toBe(shown(data.get('USERAGENTS')));
    });
});

// Counts the reads that had to look past letter case, so what a read costs
// can be asserted exactly rather than timed.
describe('the letter case work of a read with the native engine', () => {
  test('a read that finds its key as given never looks at letter case',
    async () => {
      // The count is held here and not on the Element Data, which answers an
      // unknown field by reading a property of that name.
      let caseLookups = 0;
      class CountsCaseLookups extends SwigData {
        getInternalIgnoringCase (key) {
          caseLookups++;
          return super.getInternalIgnoringCase(key);
        }
      }
      const engine = build(['IsMobile', 'BrowserName', 'PlatformName']);
      const swigResults = (await processed(engine)).device.swigResults;
      const data = new CountsCaseLookups({ flowElement: engine, swigResults });
      const expected = shown(data.get('ismobile'));
      expect(expected).not.toBe('missing');
      expect(caseLookups).toBe(0);
      // Only a key that finds nothing as given pays for the second look, and
      // it pays for one.
      expect(shown(data.get('IsMobile'))).toBe(expected);
      expect(caseLookups).toBe(1);
    });
});

// Finds nothing for a key not found as given, as every read did before letter
// case was ignored, so the read before and after can be timed in the same
// job.
class ReadByKeyOnly extends SwigData {
  getInternalIgnoringCase (key) {
    return undefined;
  }
}

// A measurement takes a few seconds, and one over the allowance is taken
// again, so the test gets more than the ten seconds setup.js gives.
const timingTestTimeoutMilliseconds = 120000;

// Backstop for a read made slower in a way the count above cannot see, such
// as letter case folded inside getInternal rather than in the second look.
describe('the time of a read with the native engine', () => {
  test('a read by name is no slower than it was', async () => {
    const timedReads = 2000;
    const pairs = 10;
    const roundsPerPair = 20;
    // The most the read may cost over the read it replaced, as a ratio. Two
    // reads of the same code measure within 1.04 of each other on every
    // runner. Folding letter case inside getInternal measures over 1.05 on
    // every runner but macOS, where it can measure 1.03, and the count above
    // is the exact check.
    const allowedRatio = 1.05;
    const engine = build(['IsMobile', 'BrowserName', 'PlatformName']);
    const swigResults = (await processed(engine)).device.swigResults;
    const timeOf = (data, key) => {
      for (let i = 0; i < timedReads; i++) {
        data.get(key);
      }
      const start = process.hrtime.bigint();
      for (let i = 0; i < timedReads; i++) {
        data.get(key);
      }
      return Number(process.hrtime.bigint() - start) / timedReads;
    };
    const middleOf = (values) => {
      const sorted = [...values].sort((a, b) => a - b);
      return sorted[Math.floor(sorted.length / 2)];
    };
    // Both reads are timed one after the other inside each round and that
    // round keeps its own ratio, so a runner that speeds up or slows down
    // between rounds moves both times together. Which goes first changes each
    // round. Each pair is built fresh because the engine can settle on a
    // faster shape for one object in a process, which has nothing to do with
    // the code. The middle of the rounds decides a measurement.
    const measure = () => {
      const beforeTimes = [];
      const afterTimes = [];
      const ratios = [];
      let last;
      for (let pair = 0; pair < pairs; pair++) {
        const before = new ReadByKeyOnly({ flowElement: engine, swigResults });
        const after = new SwigData({ flowElement: engine, swigResults });
        last = after;
        for (let round = 0; round < roundsPerPair; round++) {
          let beforeTime;
          let afterTime;
          if (round % 2 === 0) {
            beforeTime = timeOf(before, 'ismobile');
            afterTime = timeOf(after, 'ismobile');
          } else {
            afterTime = timeOf(after, 'ismobile');
            beforeTime = timeOf(before, 'ismobile');
          }
          beforeTimes.push(beforeTime);
          afterTimes.push(afterTime);
          ratios.push(afterTime / beforeTime);
        }
      }
      return {
        before: middleOf(beforeTimes),
        after: middleOf(afterTimes),
        ratio: middleOf(ratios),
        lowest: Math.min(...ratios),
        highest: Math.max(...ratios),
        mixedCase: timeOf(last, 'IsMobile')
      };
    };
    // A whole measurement can land in a slow patch, so one over the allowance
    // is taken again and the better of the two decides it. A read that really
    // is slower is slower in both.
    let result = measure();
    let measurements = 1;
    if (result.ratio > allowedRatio) {
      const again = measure();
      measurements = 2;
      if (again.ratio < result.ratio) {
        result = again;
      }
    }
    console.log(
      `Read of ismobile, the middle of ${pairs * roundsPerPair} rounds of ` +
      `${timedReads} reads, each round timing a before and an after side by ` +
      `side, before ${result.before.toFixed(0)} ns, after ` +
      `${result.after.toFixed(0)} ns, middle ratio ${result.ratio.toFixed(3)}, ` +
      `the rounds ranging from ${result.lowest.toFixed(3)} to ` +
      `${result.highest.toFixed(3)}, from ${measurements} measurement` +
      `${measurements === 1 ? '' : 's'}. A read of IsMobile, which found ` +
      `nothing before, ${result.mixedCase.toFixed(0)} ns.`);
    expect(result.ratio).toBeLessThanOrEqual(allowedRatio);
  }, timingTestTimeoutMilliseconds);
});
