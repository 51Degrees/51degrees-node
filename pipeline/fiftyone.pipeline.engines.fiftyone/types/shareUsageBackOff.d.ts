export = ShareUsageBackOff;
/**
 * Decides when usage sharing may send. Sending pauses for the initial delay
 * once the set number of sends fail within the window. A failed send after a
 * pause multiplies the delay, up to the maximum, and a successful send ends
 * the back-off. Only sending pauses, so evidence is still queued while
 * paused. Each method takes the time from the caller, in milliseconds.
 */
declare class ShareUsageBackOff {
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
    constructor({ failuresToEnterRecovery, failuresWindowSeconds, initialRecoveryDelaySeconds, maxRecoveryDelaySeconds, recoveryMultiplier }?: {
        failuresToEnterRecovery: number;
        failuresWindowSeconds: number;
        initialRecoveryDelaySeconds: number;
        maxRecoveryDelaySeconds: number;
        recoveryMultiplier: number;
    });
    failuresToEnterRecovery: number;
    failuresWindowMillis: number;
    initialRecoveryDelayMillis: number;
    maxRecoveryDelayMillis: number;
    recoveryMultiplier: number;
    failures: any[];
    delay: number;
    resumeAt: number;
    /**
     * True from the start of a pause until a send succeeds.
     *
     * @returns {boolean} whether sending is backing off
     */
    get backingOff(): boolean;
    /**
     * The time left before sending may start again.
     *
     * @param {number} now the time now in milliseconds
     * @returns {number} the milliseconds left, or zero if sending may start now
     */
    remaining(now: number): number;
    /**
     * Records a failed send.
     *
     * @param {number} now the time now in milliseconds
     * @returns {number} the new pause in milliseconds if this failure started
     * or lengthened one, otherwise zero
     */
    failed(now: number): number;
    /**
     * Records a successful send.
     *
     * @returns {boolean} true if this ended a back-off
     */
    succeeded(): boolean;
}
