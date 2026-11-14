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

// Requests the page and checks what it shows about the data file. The page
// warns when the data file is more than DATA_FILE_AGE_WARNING days old,
// and the warning has to follow the data file's published date.

const fs = require('fs');
const path = require('path');
const request = require('supertest');

const example = require(path.join(__dirname, 'gettingStarted.js'));
const { ExampleUtils, DATA_FILE_AGE_WARNING } =
  require(path.join(__dirname, '../..', 'exampleUtils'));

const WARNING =
  'WARNING: This example is using a data file that is more than';
const MS_PER_DAY = 24 * 60 * 60 * 1000;

// The published date of a data file as the engine gives it, the given
// number of whole days ago.
const publishedDaysAgo = (days) => {
  const published = new Date(Date.now() - days * MS_PER_DAY);
  return {
    getYear: () => published.getUTCFullYear(),
    getMonth: () => published.getUTCMonth() + 1,
    getDay: () => published.getUTCDate()
  };
};

// A pipeline as ExampleUtils reads it, with an engine under each key whose
// data file was published the given number of days ago.
const pipelineWith = (daysAgoByKey) => {
  const flowElements = {};
  for (const [key, days] of Object.entries(daysAgoByKey)) {
    flowElements[key] = {
      engine: { getPublishedTime: () => publishedDaysAgo(days) }
    };
  }
  return { flowElements };
};

const OLD = DATA_FILE_AGE_WARNING + 2;
const NEW = DATA_FILE_AGE_WARNING - 2;

const LITE_V_4_1_HASH = '51Degrees-LiteV4.1.hash';
const LITE_V_4_1_IPI = '51Degrees-LiteV41.ipi';

describe('mixed getting started web page', () => {
  let pipeline;
  let response;

  beforeAll(async () => {
    const options = JSON.parse(
      fs.readFileSync(path.join(__dirname, '51d.json')));
    const dataFiles = [
      ExampleUtils.findFile(LITE_V_4_1_HASH),
      ExampleUtils.findFile(LITE_V_4_1_IPI)
    ];
    options.PipelineOptions.Elements.forEach((element, i) => {
      if (element.elementName.startsWith('.')) {
        element.elementName = path.join(__dirname, element.elementName);
      }
      element.elementParameters.dataFilePath = dataFiles[i];
    });
    pipeline = example.setPipeline(options);
    response = await request(example.server).get('/?client-ip=8.8.8.8');
  });

  test('a data file is old once either one is more than the warning age',
    () => {
      expect(ExampleUtils.isDataFileOld(pipelineWith({ ip: OLD, device: NEW })))
        .toBe(true);
      expect(ExampleUtils.isDataFileOld(pipelineWith({ ip: NEW, device: OLD })))
        .toBe(true);
      expect(ExampleUtils.isDataFileOld(pipelineWith({ ip: NEW, device: NEW })))
        .toBe(false);
    });

  test('the page warns about the data files only when one is old', () => {
    expect(response.statusCode).toBe(200);
    expect(response.text.includes(WARNING))
      .toBe(ExampleUtils.isDataFileOld(pipeline));
  });
});
