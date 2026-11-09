export = ShareUsage;
declare const ShareUsage_base: typeof import("fiftyone.pipeline.engines/types/engine");
/**
 * @typedef {import('fiftyone.pipeline.core').FlowData} FlowData
 * @typedef {import('fiftyone.pipeline.core').FlowElement} FlowElement
 */
/**
 * The ShareUsage element sends usage data to 51Degrees in zipped batches
 */
declare class ShareUsage extends ShareUsage_base {
    /**
     * Constructor for ShareUsage engine
     *
     * @param {object} options settings object for share usage.
     * @param {number} options.interval If exactly the same evidence values
     * are seen multiple times within this time limit (in milliseconds) then
     * they will only be shared once.
     * @param {number} options.requestedPackageSize The usage element
     * will group data into single requests before sending it.
     * This setting controls the minimum number of entries before
     * data is sent.
     * If you are sharing large amounts of data, increasing this value
     * is recommended in order to reduce the overhead of sending HTTP
     * messages.
     * For example, the 51Degrees cloud service uses a value of 2500.
     * @param {string} options.cookie The name of the cookie that holds the
     * session id. It has no effect unless trackSession is true. The cookie
     * itself is not shared unless shareAll is true.
     * @param {Array<string>|null} options.queryWhitelist By default query
     * string and HTTP form parameters are not shared unless prefixed with
     * '51D_'. If you need to share query string parameters, a list can be
     * specified here. null shares every parameter.
     * @param {Array<string>} options.headerBlacklist By default, all HTTP
     * headers except Cookie are shared. Individual headers can
     * be excluded from sharing by adding them to this list.
     * @param {number} options.sharePercentage approximate proportion of
     * requests to be shared. 1 = 100%, 0.5 = 50%, etc..
     * @param {string} options.endpoint The target destination for usage
     * sharing data. The default is https://devices-v4.51degrees.com/new.ashx.
     * @param {boolean} options.shareAll If true, all evidence is shared apart
     * from the email address, the salt used for hashed email identifiers, and
     * the request's query string and path. False by default.
     * @param {boolean} options.trackSession If true, the cookie named by
     * cookie is used to tell user sessions apart, so evidence already shared
     * is shared again when it comes from a new session. False by default. It
     * needs cookie to be set, and has no effect when shareAll is true,
     * because every cookie is then shared and used to find repeats.
     * @param {number} options.maximumQueueSize The most entries held while
     * waiting to be sent. When the queue is full, new entries are dropped. The
     * default is 1000, or ten times requestedPackageSize if that is larger.
     * @param {number} options.requestTimeout The time in milliseconds to wait
     * for the service to answer before the send counts as failed. 60000 by
     * default.
     * @param {number} options.failuresToEnterRecovery The number of failed
     * sends within failuresWindowSeconds that pauses sending, from 1 to 100.
     * Usage data is still queued while sending is paused. 10 by default.
     * @param {number} options.failuresWindowSeconds The time in seconds over
     * which failed sends are counted. 100 by default.
     * @param {number} options.initialRecoveryDelaySeconds The length in
     * seconds of the first pause after failed sends. 2 by default.
     * @param {number} options.maxRecoveryDelaySeconds The longest a pause can
     * be, in seconds. 300 by default.
     * @param {number} options.recoveryMultiplier What the pause is multiplied
     * by each time the send tried when a pause ends fails. 2 by default.
     */
    constructor({ interval, requestedPackageSize, cookie, queryWhitelist, headerBlacklist, sharePercentage, endpoint, shareAll, trackSession, maximumQueueSize, requestTimeout, failuresToEnterRecovery, failuresWindowSeconds, initialRecoveryDelaySeconds, maxRecoveryDelaySeconds, recoveryMultiplier }?: {
        interval: number;
        requestedPackageSize: number;
        cookie: string;
        queryWhitelist: Array<string> | null;
        headerBlacklist: Array<string>;
        sharePercentage: number;
        endpoint: string;
        shareAll: boolean;
        trackSession: boolean;
        maximumQueueSize: number;
        requestTimeout: number;
        failuresToEnterRecovery: number;
        failuresWindowSeconds: number;
        initialRecoveryDelaySeconds: number;
        maxRecoveryDelaySeconds: number;
        recoveryMultiplier: number;
    }, ...args: any[]);
    trackingCookie: string;
    shareAll: boolean;
    trackSession: boolean;
    evidenceKeyFilter: ShareUsageEvidenceKeyFilter;
    dataEvidenceKeyFilter: ShareUsageEvidenceKeyFilter;
    trackerEvidenceKeyFilter: ShareUsageTrackerEvidenceKeyFilter;
    tracker: ShareUsageTracker;
    requestedPackageSize: number;
    sharePercentage: number;
    shareData: any[];
    dropped: number;
    maximumQueueSize: number;
    requestTimeout: number;
    backOff: ShareUsageBackOff;
    sending: boolean;
    resumeTimer: any;
    endpoint: url.URL;
    http: typeof import("http") | typeof import("https");
    /**
     * Internal process method which uses the ShareUsageTracker
     * to determine whether to add usage data to a batch and adds it if necessary.
     *
     * @param {FlowData} flowData flowData to process
     */
    processInternal(flowData: FlowData): void;
    /**
     * Creates a ShareUsageData instance populated from the evidence
     * within the flow data provided.
     *
     * @param {FlowData} flowData the flow data containing the evidence to use
     * @returns {ShareUsageData} New ShareUsageData instance, populated from the evidence
     * provided
     */
    getDataFromEvidence(flowData: FlowData): ShareUsageData;
    getConstantXml(): string;
    constantXml: string;
    /**
     * Internal method which adds to the share usage bundle (generating XML)
     *
     * @param {object} data key value store of current
     * evidence in FlowData (filtered by the ShareUsageEvidenceKeyFilter)
     */
    addToShareUsage(data: object): void;
    /**
     * Internal method to start sending the share usage bundle to the 51Degrees
     * servers. Nothing starts if a message is already being sent, if fewer
     * than requestedPackageSize entries are queued, or while sending is paused
     * after failed sends, in which case a timer starts sending when the pause
     * ends.
     */
    sendShareUsage(): void;
    /**
     * Start sending when the pause ends.
     *
     * @param {number} pause the milliseconds until the pause ends
     */
    scheduleResume(pause: number): void;
    /**
     * Send one message of at most twice requestedPackageSize entries, then the
     * next until fewer than requestedPackageSize are queued or a failed send
     * pauses sending.
     */
    sendNext(): void;
    /**
     * Post one message to the 51Degrees servers.
     *
     * @param {string} data the XML to send
     * @param {Function} done called once with true if the service accepted the
     * message, or false if the send failed
     */
    post(data: string, done: Function): void;
    /**
     * Return a list of FlowElements in the pipeline.
     * If the list is null then populate from the pipeline.
     * If there are multiple or no pipelines then log an error.
     *
     * @returns {Array<FlowElement>} list of flow elements
     */
    getFlowElements(): Array<FlowElement>;
    /**
     * @type {Array<FlowElement>}
     */
    flowElements: Array<FlowElement>;
}
declare namespace ShareUsage {
    export { FlowData, FlowElement };
}
import ShareUsageEvidenceKeyFilter = require("./shareUsageEvidenceKeyFilter");
import ShareUsageTrackerEvidenceKeyFilter = require("./shareUsageTrackerEvidenceKeyFilter");
import ShareUsageTracker = require("./shareUsageTracker");
import ShareUsageBackOff = require("./shareUsageBackOff");
import url = require("url");
/**
 * Internal class that is used to store details of data in memory
 * prior to it being sent to 51Degrees.
 */
declare class ShareUsageData {
    evidenceData: {};
    sessionId: string;
    clientIp: string;
    sequence: string;
    /**
     * Try to add data to shared usage
     *
     * @param {string} key key to add by
     * @param {*} value value to add
     */
    tryAddToData(key: string, value: any): void;
}
type FlowData = import("fiftyone.pipeline.core/types/flowData");
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
