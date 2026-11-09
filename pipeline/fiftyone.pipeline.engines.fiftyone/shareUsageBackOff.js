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

const { performance } = require('perf_hooks');

/**
 * The fewest failed sends that can be set to pause sending.
 */
const FAILURES_TO_ENTER_RECOVERY_MIN = 1;

/**
 * The most failed sends that can be set to pause sending.
 */
const FAILURES_TO_ENTER_RECOVERY_MAX = 100;

/**
 * Decides when usage sharing may send. Sending pauses for the initial delay
 * once the set number of sends fail within the window. A failed send after a
 * pause multiplies the delay, up to the maximum, and a successful send ends
 * the back-off. Only sending pauses, so evidence is still queued while
 * paused. Each method takes the time from the caller, in milliseconds on the
 * clock that now() reads, so a change to the system time cannot lengthen or
 * skip a pause.
 */
class ShareUsageBackOff {
  /**
   * The time in milliseconds on a monotonic clock, for the caller to pass to
   * the other methods. Its zero is not a calendar time.
   *
   * @returns {number} the milliseconds
   */
  static now () {
    return performance.now();
  }

  /**
   * Constructor for ShareUsageBackOff
   *
   * @param {object} options settings for the back-off
   * @param {number} options.failuresToEnterRecovery the number of failed
   * sends within the failures window that pauses sending, from 1 to 100
   * @param {number} options.failuresWindowSeconds the time in seconds over
   * which failed sends are counted
   * @param {number} options.initialRecoveryDelaySeconds the length in seconds
   * of the first pause
   * @param {number} options.maxRecoveryDelaySeconds the longest a pause can
   * be, in seconds
   * @param {number} options.recoveryMultiplier what the pause is multiplied
   * by each time the send tried when a pause ends fails
   */
  constructor ({
    failuresToEnterRecovery = 10,
    failuresWindowSeconds = 100,
    initialRecoveryDelaySeconds = 2.0,
    maxRecoveryDelaySeconds = 300.0,
    recoveryMultiplier = 2.0
  } = {}) {
    if (!(Number.isInteger(failuresToEnterRecovery) &&
      failuresToEnterRecovery >= FAILURES_TO_ENTER_RECOVERY_MIN &&
      failuresToEnterRecovery <= FAILURES_TO_ENTER_RECOVERY_MAX)) {
      throw new RangeError(
        'failuresToEnterRecovery must be from ' +
        `${FAILURES_TO_ENTER_RECOVERY_MIN} to ` +
        `${FAILURES_TO_ENTER_RECOVERY_MAX}. ` +
        `Received: ${failuresToEnterRecovery}.`);
    }
    if (!(failuresWindowSeconds >= 1)) {
      throw new RangeError('failuresWindowSeconds must be 1 or more.');
    }
    if (!(initialRecoveryDelaySeconds > 0)) {
      throw new RangeError('initialRecoveryDelaySeconds must be more than 0.');
    }
    if (!(maxRecoveryDelaySeconds > 0)) {
      throw new RangeError('maxRecoveryDelaySeconds must be more than 0.');
    }
    if (!(recoveryMultiplier >= 1)) {
      throw new RangeError('recoveryMultiplier must be 1 or more.');
    }
    this.failuresToEnterRecovery = failuresToEnterRecovery;
    this.failuresWindowMillis = failuresWindowSeconds * 1000;
    this.initialRecoveryDelayMillis = initialRecoveryDelaySeconds * 1000;
    this.maxRecoveryDelayMillis = maxRecoveryDelaySeconds * 1000;
    this.recoveryMultiplier = recoveryMultiplier;
    // When each recent failed send happened, oldest first. Empty while
    // backing off.
    this.failures = [];
    // The length of the current pause, or zero when not backing off.
    this.delay = 0;
    // When sending may start again.
    this.resumeAt = null;
  }

  /**
   * True from the start of a pause until a send succeeds.
   *
   * @returns {boolean} whether sending is backing off
   */
  get backingOff () {
    return this.delay > 0;
  }

  /**
   * The time left before sending may start again.
   *
   * @param {number} now the time now in milliseconds
   * @returns {number} the milliseconds left, or zero if sending may start now
   */
  remaining (now) {
    return this.resumeAt === null || this.resumeAt <= now
      ? 0
      : this.resumeAt - now;
  }

  /**
   * Records a failed send.
   *
   * @param {number} now the time now in milliseconds
   * @returns {number} the new pause in milliseconds if this failure started
   * or lengthened one, otherwise zero
   */
  failed (now) {
    if (this.delay > 0) {
      // The send tried when the last pause ended failed.
      this.delay = Math.min(
        this.delay * this.recoveryMultiplier,
        this.maxRecoveryDelayMillis);
    } else {
      this.failures.push(now);
      while (this.failures[0] < now - this.failuresWindowMillis) {
        this.failures.shift();
      }
      if (this.failures.length < this.failuresToEnterRecovery) {
        return 0;
      }
      this.failures = [];
      this.delay = Math.min(
        this.initialRecoveryDelayMillis,
        this.maxRecoveryDelayMillis);
    }
    this.resumeAt = now + this.delay;
    return this.delay;
  }

  /**
   * Records a successful send.
   *
   * @returns {boolean} true if this ended a back-off
   */
  succeeded () {
    if (this.delay === 0) {
      return false;
    }
    this.delay = 0;
    this.resumeAt = null;
    return true;
  }
}

module.exports = ShareUsageBackOff;
