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

const util = require('util');
const path = require('path');

const coreErrorMessages = require(path.resolve(__dirname, '../../fiftyone.pipeline.core/errorMessages'));
const errorMessages = require(path.resolve(__dirname, '../errorMessages'));
const Engine = require(path.resolve(__dirname, '../engine'));
const PipelineBuilder = require(path.resolve(__dirname, '../../fiftyone.pipeline.core/pipelineBuilder'));
const AspectDataDictionary = require(path.resolve(__dirname, '../aspectDataDictionary'));
const BasicListEvidenceKeyFilter = require(path.resolve(__dirname, '../../fiftyone.pipeline.core/basicListEvidenceKeyFilter'));
const LruCache = require(path.resolve(__dirname, '../lruCache'));

const cache = new LruCache({ size: 1 });

// Flag to test cache

let hasRun = false;

const testEngine = new Engine(
  {
    dataKey: 'testEngine',
    cache,
    restrictedProperties: ['one', 'noCache'],
    evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
    properties: {
      one: {
        meta: {
          type: 'int'
        }
      },
      two: {
        meta: {
          type: 'int'
        }
      }
    },
    processInternal: function (flowData) {
      const contents = { one: 1, two: 2 };

      // Check if flowData has been processed before (for cache test)

      contents.noCache = hasRun;

      const data = new AspectDataDictionary(
        { flowElement: this, contents }
      );

      flowData.setElementData(data);

      hasRun = true;
    }
  }
);

const flowData = new PipelineBuilder().add(testEngine).build().createFlowData();

test('engine process', done => {
  flowData.process().then(function () {
    expect(flowData.get('testEngine').get('one')).toBe(1);

    done();
  });
});

test('restricted properties', done => {
  flowData.process().then(function () {
    try {
      flowData.get('testEngine').get('two');
    } catch (e) {
      expect(e.indexOf(
        util.format(errorMessages.propertyExcluded, 'two')) !== -1).toBe(true);
    }

    done();
  });
});

test('restricted properties are compared ignoring case', async () => {
  // An engine restricted to a name in the data set's own spelling still
  // gives that property under its lower case key, and still refuses one it
  // was not given.
  expect.assertions(2);
  const engine = new Engine(
    {
      dataKey: 'caseEngine',
      restrictedProperties: ['One'],
      evidenceKeyFilter: new BasicListEvidenceKeyFilter(['header.user-agent']),
      properties: {
        one: { meta: { type: 'int' } },
        two: { meta: { type: 'int' } }
      },
      processInternal: function (flowData) {
        flowData.setElementData(new AspectDataDictionary(
          { flowElement: this, contents: { one: 1, two: 2 } }));
      }
    }
  );
  const caseFlowData = new PipelineBuilder().add(engine).build()
    .createFlowData();
  await caseFlowData.process();
  expect(caseFlowData.get('caseEngine').get('one')).toBe(1);
  try {
    caseFlowData.get('caseEngine').get('two');
  } catch (e) {
    expect(e).toBe(util.format(errorMessages.propertyExcluded, 'two'));
  }
});

test('missing property service', done => {
  flowData.process().then(function () {
    try {
      flowData.get('testEngine').get('three');
    } catch (e) {
      expect(e.indexOf(
        util.format(coreErrorMessages.genericMissingProperties, 'three') +
        ' in data for element "testEngine".' +
        util.format(coreErrorMessages.noReasonUnknown)) !== -1).toBe(true);
    }

    done();
  });
});

test('cache', done => {
  flowData.process().then(function () {
    expect(flowData.get('testEngine').get('noCache')).toBe(false);

    done();
  });
});

// Property names are compared ignoring case, so a key finds its value in any
// letter case, including a key stored in mixed case.
test('a dictionary of aspect data finds a key whatever its letter case', () => {
  const data = new AspectDataDictionary({
    flowElement: { dataKey: 'caseTest' },
    contents: { one: 1, noCache: false }
  });
  expect(data.get('one')).toBe(1);
  expect(data.get('One')).toBe(1);
  expect(data.get('ONE')).toBe(1);
  expect(data.get('noCache')).toBe(false);
  expect(data.get('nocache')).toBe(false);
});

// Reads each key exactly as given, as the dictionary did before letter case
// was ignored, so the read before and after can be timed in the same job.
class ReadByKeyOnly extends AspectDataDictionary {
  getInternal (key) {
    return this.contents[key];
  }
}

test('a dictionary read is no slower than it was', () => {
  // Reads timed in each round, and rounds of each, taking the fastest, so a
  // pause in one does not decide it.
  const timedReads = 1000000;
  const rounds = 5;
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
  const flowElement = { dataKey: 'timing' };
  const contents = { one: 1, two: 2, noCache: false };
  const before = new ReadByKeyOnly({ flowElement, contents });
  const after = new AspectDataDictionary({ flowElement, contents });
  let beforeTime = Infinity;
  let afterTime = Infinity;
  for (let round = 0; round < rounds; round++) {
    beforeTime = Math.min(beforeTime, timeOf(before, 'one'));
    afterTime = Math.min(afterTime, timeOf(after, 'one'));
  }
  console.log(
    `Dictionary read of one, fastest of ${rounds} rounds of ${timedReads}, ` +
    `before ${beforeTime.toFixed(1)} ns, after ${afterTime.toFixed(1)} ns.`);
  // A tenth is allowed for timing noise.
  expect(afterTime).toBeLessThanOrEqual(beforeTime * 1.1);
});
