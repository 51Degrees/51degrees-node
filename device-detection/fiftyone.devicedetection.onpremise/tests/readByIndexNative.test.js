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

// The engine reads each property by its index in the list of names it was
// built with, checked against the native engine and a real data file. The
// last two tests print how long a read by name and a read by index take,
// which is the figure the change is for.

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

const dataFile = testHelper.getDataFilePath(testHelper.liteDataFileName);
const mobileUserAgent =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1 like Mac OS X) AppleWebKit/537' +
  '.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D167 Safari/9537.53';

// Reads timed for the figures the tests print.
const timedReads = 20000;
// Reads taken before timing, so a figure is not the cost of the first call.
const warmUpReads = 2000;

const build = (restrictedProperties) => new EngineBuilder({
  dataFilePath: dataFile,
  licenceKeys: '',
  autoUpdate: false,
  restrictedProperties
});

// Processes one User-Agent and gives back the Element Data. The Element
// Data throws for a property it does not hold, `then` included, so it is
// read from the Flow Data after the wait rather than given to a promise.
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

describe('reading by index with the native engine', () => {
  test('an engine built with names holds a table in that order', () => {
    const names = ['PlatformName', 'IsMobile', 'BrowserName'];
    const engine = build(names);
    expect(engine.buildPropertyNames).toEqual(names);
    expect(engine.propertyIndexes).toEqual(
      { platformname: 0, ismobile: 1, browsername: 2 });
  });

  test('an engine built with no names holds no table', () => {
    // Out of scope for now, so an engine with no names keeps reading by
    // name exactly as it did before.
    const engine = build(undefined);
    expect(engine.buildPropertyNames).toEqual([]);
    expect(engine.propertyIndexes).toEqual({});
  });

  test('the name at each index is the name the engine was built with',
    async () => {
      // This is what the rule rests on. The native code gives a property the
      // place of its name among the names given, whatever order the data set
      // holds, so the table and the native engine must agree.
      const names = ['PlatformName', 'IsMobile', 'BrowserName'];
      const data = (await processed(build(names))).device;
      names.forEach((name, index) => {
        expect(data.swigResults.getPropertyName(index)).toBe(name);
      });
    });

  test('names in another order read the same values', async () => {
    // The same properties, built in two orders, so each engine gives them
    // different indexes. Every value still matches, which is what a reload
    // into a different data set order does.
    const names = ['IsMobile', 'BrowserName', 'PlatformName', 'IsCrawler'];
    const forwards = (await processed(build(names))).device;
    const backwards =
      (await processed(build([...names].reverse()))).device;
    for (const name of names) {
      expect(shown(backwards.get(name.toLowerCase())))
        .toBe(shown(forwards.get(name.toLowerCase())));
    }
  });

  test('a superset of the built names reads the same values', async () => {
    // One engine built with a few names, another with those and more. The
    // shared names read the same although their indexes differ.
    const few = ['IsMobile', 'BrowserName'];
    const many = ['PlatformName', 'IsMobile', 'IsCrawler', 'BrowserName'];
    const small = (await processed(build(few))).device;
    const large = (await processed(build(many))).device;
    for (const name of few) {
      expect(shown(large.get(name.toLowerCase())))
        .toBe(shown(small.get(name.toLowerCase())));
    }
  });

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

  test('a property outside the built names has no index', async () => {
    // A name the engine was not built with keeps no index, so the read
    // falls back to the name and the native code answers for itself.
    const engine = build(['IsMobile']);
    await processed(engine);
    expect(engine.propertyIndexes.screenpixelswidth).toBeUndefined();
  });

  test('a read by index is not slower than a read by name', async () => {
    const engine = build(['IsMobile', 'BrowserName', 'PlatformName']);
    const data = (await processed(engine)).device;
    const results = data.swigResults;
    const index = engine.propertyIndexes.ismobile;

    // Both routes give the same answer before either is timed.
    expect(results.getValueAsBool(index).getValue())
      .toBe(results.getValueAsBool('IsMobile').getValue());

    for (let i = 0; i < warmUpReads; i++) {
      results.getValueAsBool('IsMobile');
      results.getValueAsBool(index);
    }

    let start = process.hrtime.bigint();
    for (let i = 0; i < timedReads; i++) {
      results.getValueAsBool('IsMobile');
    }
    const byName = Number(process.hrtime.bigint() - start) / timedReads;

    start = process.hrtime.bigint();
    for (let i = 0; i < timedReads; i++) {
      results.getValueAsBool(index);
    }
    const byIndex = Number(process.hrtime.bigint() - start) / timedReads;

    console.log(
      `Native read of IsMobile ${timedReads} times, by name ` +
      `${byName.toFixed(0)} ns a read, by index ${byIndex.toFixed(0)} ns ` +
      `a read, ${(byName / byIndex).toFixed(2)} times`);

    // A read by index must not cost more than a read by name, which is the
    // whole point of the change.
    expect(byIndex).toBeLessThanOrEqual(byName);
  });

  test('an Element Data read is not slower than it was', async () => {
    // Times the route a caller takes, with the table in place and with it
    // taken away, so the figures are before and after on one engine and one
    // set of results.
    const engine = build(['IsMobile', 'BrowserName', 'PlatformName']);
    const data = (await processed(engine)).device;
    const table = engine.propertyIndexes;

    const time = () => {
      for (let i = 0; i < warmUpReads; i++) {
        data.get('ismobile');
      }
      const start = process.hrtime.bigint();
      for (let i = 0; i < timedReads; i++) {
        data.get('ismobile');
      }
      return Number(process.hrtime.bigint() - start) / timedReads;
    };

    // Before, with no table, so the read goes by name as it did.
    engine.propertyIndexes = {};
    const before = time();
    // After, with the table, so the read goes by index.
    engine.propertyIndexes = table;
    const after = time();

    console.log(
      `Element Data read of IsMobile ${timedReads} times, by name ` +
      `${before.toFixed(0)} ns a read, by index ${after.toFixed(0)} ns ` +
      `a read, ${(before / after).toFixed(2)} times`);

    expect(after).toBeLessThanOrEqual(before);
  });

  // DIAGNOSTIC, to be removed. Times the same native reads with the stack
  // trace limit varied, to show whether the extra cost of a read by index is
  // the Error object the wrapper's overload dispatch makes when the string
  // overload, tried first, refuses a number.
  test('diagnostic: the cost of a native read with the stack limit varied',
    async () => {
      const engine = build(['IsMobile', 'BrowserName', 'PlatformName']);
      const data = (await processed(engine)).device;
      const results = data.swigResults;
      const index = engine.propertyIndexes.ismobile;
      const message = 'in method \'ResultsBaseSwig_getValueAsBool\', ' +
        'argument 2 of type \'std::string const &\'';
      const time = (read) => {
        for (let i = 0; i < warmUpReads; i++) {
          read();
        }
        const start = process.hrtime.bigint();
        for (let i = 0; i < timedReads; i++) {
          read();
        }
        return (Number(process.hrtime.bigint() - start) / timedReads)
          .toFixed(0);
      };
      // Runs the timing 60 frames down, so a limit of 50 has frames to take.
      const deep = (depth, run) => depth === 0 ? run() : deep(depth - 1, run);
      const limit = Error.stackTraceLimit;
      const rows = [];
      try {
        for (const frames of [0, 10, 50]) {
          Error.stackTraceLimit = frames;
          deep(60, () => rows.push(
            `DIAG stackTraceLimit ${frames}: ` +
            `getValueAsBool('IsMobile') ` +
            `${time(() => results.getValueAsBool('IsMobile'))} ns, ` +
            `getValueAsBool(${index}) ` +
            `${time(() => results.getValueAsBool(index))} ns, ` +
            `getPropertyName(${index}) one overload ` +
            `${time(() => results.getPropertyName(index))} ns, ` +
            `containsProperty('IsMobile') one overload ` +
            `${time(() => results.containsProperty('IsMobile'))} ns, ` +
            `new Error(message) ${time(() => new Error(message))} ns`));
        }
      } finally {
        Error.stackTraceLimit = limit;
      }
      console.log(rows.join('\n'));
    });
});
