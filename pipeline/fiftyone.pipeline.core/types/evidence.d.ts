export = Evidence;
/**
 * @typedef {import('./flowData')} FlowData
 */
/**
 * Storage of evidence on a flowData object
 */
declare class Evidence {
    /**
     * Constructor for evidence
     *
     * @param {FlowData} flowData FlowData to add the evidence to
     */
    constructor(flowData: FlowData);
    flowData: import("./flowData");
    evidenceStore: {};
    keys: {};
    /**
     * Every value addFromRequest read from the request, under its evidence
     * key and before any is filtered out, or undefined when evidence was
     * not added from a request.
     *
     * @type {Readonly<object>|undefined}
     */
    requestEvidence: Readonly<object> | undefined;
    /**
     * Add a piece of evidence to flowData. Keys ignore letter case, so a key
     * that differs from one already added only in its letters replaces that
     * value under the letters it was first added with.
     *
     * @param {string} key evidence key to add
     * @param {*} value value of evidence key
     */
    add(key: string, value: any): void;
    /**
     * Add a piece of evidence to flowData as an object
     *
     * @param {object} evidenceObject key value map of evidence
     * @param {string} evidenceObject.key evidencekey
     * @param {*} evidenceObject.value evidence value
     */
    addObject(evidenceObject: {
        key: string;
        value: any;
    }): void;
    /**
     * Add evidence to flowData from an HTTP request
     * This helper automatically adds evidence:
     * headers, cookies, protocol, IP, query params and, for a POST with a
     * form body, the form values.
     *
     * Form values are added as query evidence after the query string, so a
     * form value replaces a query string value of the same name. They are
     * read from request.body, which a framework's form parser sets, either as
     * an object or as the body text. A plain Node request has no request.body,
     * so use addFromRequestAsync to read the body from the request instead.
     * The 51Degrees client script sends its values in a form body, so without
     * one or the other they never reach the pipeline.
     *
     * Every value read is also kept in requestEvidence, so that what the
     * request carried can be used once processing is done, when the request's
     * socket may have closed.
     *
     * @param {object} request an HTTP request object
     * @returns {Evidence} return updated evidence
     */
    addFromRequest(request: object): Evidence;
    /**
     * Add evidence to flowData from an HTTP request, first reading a form
     * body from the request when it is a POST with a form body and nothing
     * has read the body already. The body text is kept in request.body, and
     * then addFromRequest adds the evidence. A body larger than
     * maxFormBytes is not read and no form values are added.
     *
     * @param {object} request an HTTP request object
     * @param {number} [maxFormBytes] the largest form body read, one
     * mebibyte unless given
     * @returns {Promise<Evidence>} the updated evidence
     */
    addFromRequestAsync(request: object, maxFormBytes?: number): Promise<Evidence>;
    /**
     * Get a piece of evidence by key, in any letter case
     *
     * @param {string} key evidence key to retreive
     * @returns {*} the evidence value, or undefined where there is none
     */
    get(key: string): any;
    /**
     * Get all evidence
     *
     * @returns {object} all evidence
     */
    getAll(): object;
}
declare namespace Evidence {
    export { FlowData };
}
type FlowData = import("./flowData");
