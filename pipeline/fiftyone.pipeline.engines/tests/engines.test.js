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

// An element given restricted names without an engine's constructor makes
// its lower case set on the first read and keeps it for later reads.
test('an element restricted without an engine keeps its lower case names',
  () => {
    const flowElement = { dataKey: 'plain', restrictedProperties: ['One'] };
    const data = new AspectDataDictionary(
      { flowElement, contents: { one: 1 } });
    expect(data.get('one')).toBe(1);
    const keys = flowElement.restrictedPropertyKeys;
    expect(keys).toEqual(new Set(['one']));
    expect(data.get('one')).toBe(1);
    expect(flowElement.restrictedPropertyKeys).toBe(keys);
  });

// Finds nothing for a key not found as given, as the dictionary did before
// letter case was ignored, so the read before and after can be timed in the
// same job.
class ReadByKeyOnly extends AspectDataDictionary {
  getInternalIgnoringCase (key) {
    return undefined;
  }
}

test('a dictionary read is no slower than it was', () => {
  // Both dictionaries are timed one after the other inside each round and
  // that round keeps its own ratio, so a runner that speeds up or slows down
  // between rounds moves both times together and cancels out. Which of the
  // two goes first changes each round, so neither gets the warm cache every
  // time. Fresh dictionaries are made for each pair because the engine can
  // settle on a faster shape for one object in a process, which is worth
  // about a seventh and is nothing to do with the code. The middle of all the
  // rounds decides it, so neither a round that loses its turn on a shared
  // machine nor a pair that drew a slower shape can.
  const timedReads = 200000;
  const pairs = 7;
  const roundsPerPair = 2;
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
  const beforeTimes = [];
  const afterTimes = [];
  const ratios = [];
  let last;
  for (let pair = 0; pair < pairs; pair++) {
    const flowElement = { dataKey: 'timing' };
    const contents = { one: 1, two: 2, noCache: false };
    const before = new ReadByKeyOnly({ flowElement, contents });
    const after = new AspectDataDictionary({ flowElement, contents });
    last = after;
    for (let round = 0; round < roundsPerPair; round++) {
      let beforeTime;
      let afterTime;
      if (round % 2 === 0) {
        beforeTime = timeOf(before, 'one');
        afterTime = timeOf(after, 'one');
      } else {
        afterTime = timeOf(after, 'one');
        beforeTime = timeOf(before, 'one');
      }
      beforeTimes.push(beforeTime);
      afterTimes.push(afterTime);
      ratios.push(afterTime / beforeTime);
    }
  }
  const middleRatio = middleOf(ratios);
  const mixedCaseTime = timeOf(last, 'One');
  console.log(
    `Dictionary read of one, ${pairs} fresh pairs of dictionaries timed ` +
    `side by side for ${roundsPerPair} rounds of ${timedReads} each, ` +
    `before ${middleOf(beforeTimes).toFixed(1)} ns, after ` +
    `${middleOf(afterTimes).toFixed(1)} ns, middle ratio ` +
    `${middleRatio.toFixed(3)}, the rounds ranging from ` +
    `${Math.min(...ratios).toFixed(3)} to ${Math.max(...ratios).toFixed(3)}. ` +
    'A read of One, which found nothing before, ' +
    `${mixedCaseTime.toFixed(1)} ns.`);
  // A read that finds its key as given returns before letter case is looked
  // at, so the two measure the same work and a twentieth covers what is left.
  // Folding case on every read, which is what this catches, costs about three
  // times a plain read, as the read of One above shows.
  expect(middleRatio).toBeLessThanOrEqual(1.05);
});
