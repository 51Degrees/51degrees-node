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

// The Programmatic update part of the Data update page starts an immediate
// check. It does not start another polling schedule, so polling carries on
// at the polling interval however many updates are started by hand.

const path = require('path');

const DataFileUpdateService = require(
  path.resolve(__dirname, '..', 'dataFileUpdateService'));
const AutoUpdateStatus = require(
  path.resolve(__dirname, '..', 'autoUpdateStatus'));

const PollingMinutes = 30;
const RandomisationMinutes = 10;
const MinuteMilliseconds = 60000;

// A data file that polls. Its update fails to connect, so no server is needed,
// and the failure is reported through the real network.
const pollingDataFile = () => ({
  updateUrl: 'http://127.0.0.1:1/datafile',
  verifyIfModifiedSince: false,
  autoUpdate: true,
  updateOnStart: false,
  attemptedDownload: false,
  updating: false,
  pollingInterval: PollingMinutes,
  updateTimeMaximumRandomisation: RandomisationMinutes,
  getNextUpdate: () => new Date(0),
  flowElement: { dataKey: 'testEngine' }
});

const failed = (service) => new Promise((resolve) => {
  service.once('updateComplete', (status) => resolve(status));
});

describe('polling timer', () => {
  beforeEach(() => {
    // Only the timers are faked, so the network still works.
    jest.useFakeTimers({
      doNotFake: ['nextTick', 'setImmediate', 'queueMicrotask']
    });
  });

  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  test('an update started by hand leaves one timer pending', async () => {
    const service = new DataFileUpdateService({ log: () => {} });
    const dataFile = pollingDataFile();
    service.checkNextUpdate(dataFile);
    expect(jest.getTimerCount()).toBe(1);

    const done = failed(service);
    service.updateDataFile(dataFile);
    expect(await done).toBe(AutoUpdateStatus.AUTO_UPDATE_HTTPS_ERR);

    expect(jest.getTimerCount()).toBe(1);
  });

  test('several updates started by hand still leave one timer pending',
    async () => {
      const service = new DataFileUpdateService({ log: () => {} });
      const dataFile = pollingDataFile();
      service.checkNextUpdate(dataFile);
      for (let i = 0; i < 3; i++) {
        const done = failed(service);
        service.updateDataFile(dataFile);
        await done;
      }
      expect(jest.getTimerCount()).toBe(1);
    });

  test('polling checks once in an interval after updates by hand',
    async () => {
      const service = new DataFileUpdateService({ log: () => {} });
      const dataFile = pollingDataFile();
      const update = jest.spyOn(service, 'updateDataFile');
      service.checkNextUpdate(dataFile);
      for (let i = 0; i < 2; i++) {
        const done = failed(service);
        service.updateDataFile(dataFile);
        await done;
      }
      update.mockClear();

      // The longest wait is the polling interval plus the randomisation.
      jest.advanceTimersByTime(
        (PollingMinutes + RandomisationMinutes) * MinuteMilliseconds);
      expect(update).toHaveBeenCalledTimes(1);
    });

  test('polling carries on after a check the timer started', async () => {
    const service = new DataFileUpdateService({ log: () => {} });
    const dataFile = pollingDataFile();
    const update = jest.spyOn(service, 'updateDataFile');
    service.checkNextUpdate(dataFile);

    for (let i = 0; i < 2; i++) {
      const done = failed(service);
      jest.advanceTimersByTime(
        (PollingMinutes + RandomisationMinutes) * MinuteMilliseconds);
      await done;
    }
    expect(update).toHaveBeenCalledTimes(2);
    expect(jest.getTimerCount()).toBe(1);
  });
});
