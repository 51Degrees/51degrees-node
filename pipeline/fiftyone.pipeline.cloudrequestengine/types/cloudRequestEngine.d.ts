export = CloudRequestEngine;
declare const CloudRequestEngine_base: typeof import("fiftyone.pipeline.engines/types/engine");
declare class CloudRequestEngine extends CloudRequestEngine_base {
    /**
     * Constructor for CloudRequestEngine
     *
     * @param {object} options options object
     * @param {string} options.resourceKey resourcekey for cloud service
     * @param {string} options.licenseKey licensekey for cloud service, beside
     * a resourceKey or on its own. On its own, requestedProperties is
     * required.
     * @param {Array<string>|string} options.requestedProperties the fully
     * qualified names of the properties to ask for, such as device.ismobile,
     * as a list or one comma separated string. Beside a resourceKey the cloud
     * service adds them to the properties the resource key carries.
     * @param {string} options.baseURL url the cloud service is located at
     * if overriding default
     * @param {string} options.cloudRequestOrigin The value to set for the Origin
     * header when making requests to the cloud service.
     * This is used by the cloud service to check that the request is being
     * made from a origin matching those allowed by the resource key.
     * For more detail, see the 'Request Headers' section in the
     * <a href="https://cloud.51degrees.com/api-docs/index.html">cloud documentation</a>.
     * @param {RequestClient} options.requestClient Set predefined RequestClient.
     */
    constructor({ resourceKey, licenseKey, requestedProperties, baseURL, cloudRequestOrigin, requestClient }: {
        resourceKey: string;
        licenseKey: string;
        requestedProperties: Array<string> | string;
        baseURL: string;
        cloudRequestOrigin: string;
        requestClient: RequestClient;
    }, ...args: any[]);
    resourceKey: string;
    licenseKey: string;
    requestedProperties: string[];
    notCoveredReported: boolean;
    cloudRequestOrigin: string;
    requestClient: RequestClient;
    baseURL: string;
    evidenceKeys: any[];
    evidenceKeysFetched: boolean;
    flowElementProperties: {};
    /**
     * Check if the keys and properties have been fetched.
     *
     * True once the cloud service's evidence keys have arrived and its
     * properties have been read, so they are fetched once rather than for
     * every request.
     *
     * @returns {boolean} True if the keys and properties are fetched and ready; otherwise, false.
     */
    get keysAndPropertiesFetched(): boolean;
    /**
     * Fetches evidence keys and properties data.
     *
     * This method asynchronously fetches evidence keys and properties required for the operation.
     * It uses Promises to handle data retrieval and provides callback functions for success and failure scenarios.
     *
     * @param {Function} resolveCallback - A callback function to be called when the data is successfully fetched.
     * It will receive the current instance as a parameter.
     *
     * @param {Function} rejectCallback - A callback function to be called when an error occurs during data retrieval.
     * It will receive the error information as a parameter.
     */
    fetchEvidenceKeysAndProperties(resolveCallback: Function, rejectCallback: Function): void;
    /**
     * Internal process for cloud engine
     * Returns raw JSON as a "cloud" property in "cloud"
     *
     * @param {FlowData} flowData flowData to process
     * @returns {Promise} data from cloud service
     */
    processInternal(flowData: FlowData): Promise<any>;
    /**
     * Fetches the evidence keys and properties before the first process,
     * whatever else is in the pipeline, because the cache key is built from
     * the evidence keys. A fetch that fails is tried again on the next
     * process, and its error is the process error.
     *
     * @param {FlowData} flowData FlowData to process
     * @returns {Promise} resolved once the FlowData is processed
     */
    process(flowData: FlowData): Promise<any>;
    discovery: any;
    /**
     * Typically, cloud will return errors as JSON.
     * However, transport level errors or other failures can result in
     * responses that are plain text. This function handles these cases.
     *
     * @param {string} responseBody the response data to process
     * @returns {Array} The error messages
     */
    getErrorMessages(responseBody: string): any[];
    /**
     * Used to handle errors from http requests
     *
     * @param {import('http').ServerResponse} response Responce to get errors from
     * @returns {Array<CloudRequestError>} Array of CloudRequestError from response
     */
    getErrorsFromResponse(response: import("http").ServerResponse): Array<CloudRequestError>;
    /**
     * Internal process to fetch all the properties available under a resourcekey
     *
     * @returns {Promise<object>} properties from the cloud server
     */
    fetchProperties(): Promise<object>;
    /**
     * Properties transform
     *
     * @param {object} properties properties to transform
     * @returns {object} transformed properties
     */
    propertiesTransform(properties: object): object;
    /**
     * Meta property transform
     *
     * @param {string} key key to check
     * @param {object} value properties to transform
     * @returns {object} transformed properties
     */
    metaPropertyTransform(key: string, value: object): object;
    /**
     * Internal function to get data from cloud service
     *
     * @param {FlowData} flowData
     * FlowData used to extract evidence and send to cloud service
     * for processing
     * @returns {Promise} result of processing
     */
    getData(flowData: FlowData): Promise<any>;
    /**
     * Compares the requested properties with an answer and logs, once, the
     * names the answer left out. The cloud service drops a property the keys
     * do not cover without naming it, so only the engine can notice. A
     * property present but null counts as answered, because its nullreason
     * says why it has no value. The answer cannot change while the keys and
     * the list stay the same, so one comparison is enough.
     *
     * @param {FlowData} flowData the flow data whose pipeline is logged to
     * @param {string} body the JSON the cloud service answered with
     */
    reportPropertiesNotCovered(flowData: FlowData, body: string): void;
    /**
     * Internal function to get evidenceKeys used by cloud resourcekey
     *
     * @returns {Promise} evidence promise
     */
    getEvidenceKeys(): Promise<any>;
    /**
     * Generate the Content to send in the POST request. One name under
     * several prefixes is sent once, with the value of the prefix that
     * evidence.md ranks highest, being query, header, cookie, server,
     * fiftyone and location, then any other prefix alphabetically. The
     * groups are added lowest precedence first, so a later value replaces
     * an earlier one.
     * If there are evidence keys other than 'query.' that conflict then
     * this is unexpected so a warning will be logged.
     *
     * The engine sends every Evidence value in the Flow Data, including the
     * values no element in the pipeline accepts, because what the cloud
     * service uses changes over time and knowing about the other Evidence is
     * important to continued optimization. The reserved names and the web
     * request view are left out.
     *
     * @param {FlowData} flowData FlowData to get evidence from
     * @returns {object} Evidence Dictionary
     */
    getContent(flowData: FlowData): object;
    /**
     * The evidence the engine sends, being every value in the Flow Data,
     * whether an element accepted it or not, apart from the web request
     * view. addQueryData then leaves out the reserved names. The accepted
     * values come first, so where the two would give the same name the
     * accepted one is sent.
     *
     * @param {Evidence} evidence the Flow Data's evidence
     * @returns {object} the evidence keys and values to send
     */
    sendableEvidence(evidence: Evidence): object;
    /**
     * Whether an evidence key is sent to the cloud service. The reserved
     * names are left out later, by addQueryData.
     *
     * @param {string} key the evidence key
     * @returns {boolean} false for the web request view, in any letter case
     */
    isSent(key: string): boolean;
    /**
     * Add query data to the evidence.
     *
     * @param {FlowData} flowData FlowData for logging
     * @param {object} queryData The destination dictionary to add query data to.
     * @param {Evidence} allEvidence All evidence in the flow data. This is used to
     * report which evidence keys are conflicting.
     * @param {object} evidence Evidence to add to the query Data.
     */
    addQueryData(flowData: FlowData, queryData: object, allEvidence: Evidence, evidence: object): void;
    /**
     * Get evidence with specified prefix.
     *
     * @param {Evidence} evidence All evidence in the flow data.
     * @param {string} type Required evidence key prefix
     * @returns {Evidence} Selected evidence
     */
    getSelectedEvidence(evidence: Evidence, type: string): Evidence;
    /**
     * Check that the key of a KeyValuePair has the given prefix, ignoring
     * letter case as evidence keys do.
     *
     * @param {string} itemKey Key to check
     * @param {string} prefix The prefix to check for.
     * @returns {boolean} True if the key has the prefix.
     */
    hasKeyPrefix(itemKey: string, prefix: string): boolean;
}
declare namespace CloudRequestEngine {
    export { FlowData, Evidence };
}
import RequestClient = require("./requestClient");
import CloudRequestError = require("./cloudRequestError");
type FlowData = import("fiftyone.pipeline.core/types/flowData");
type Evidence = import("fiftyone.pipeline.core/types/evidence");
