export = CloudDiscoveryState;
/**
 * A copy of what the Cloud Request Engine's discovery fetched, being the
 * evidence keys the cloud service accepts and its answer listing the
 * accessible properties, which depend only on the keys in use. An engine
 * given a copy makes no discovery request. The JSON is the form the Java
 * package's CloudDiscoveryState writes.
 */
declare class CloudDiscoveryState {
    /**
     * Reads a copy from the JSON toJson writes, as text or parsed.
     *
     * @param {string|object} json the copy's JSON
     * @returns {CloudDiscoveryState} the copy
     * @throws {TypeError} when the text is not JSON, or either part is missing
     */
    static fromJson(json: string | object): CloudDiscoveryState;
    /**
     * Constructor for CloudDiscoveryState
     *
     * @param {Array<string>} evidenceKeys the evidence keys the cloud service
     * accepts, as its evidencekeys answer lists them
     * @param {string|object} accessibleProperties the cloud service's
     * accessibleproperties answer, as JSON text or parsed
     * @throws {TypeError} when the evidence keys are not a list, the answer is
     * not JSON, or it has no Products member
     */
    constructor(evidenceKeys: Array<string>, accessibleProperties: string | object);
    /**
     * The evidence keys the cloud service accepts.
     *
     * @type {ReadonlyArray<string>}
     */
    evidenceKeys: ReadonlyArray<string>;
    /**
     * The accessible properties answer, as JSON text.
     *
     * @type {string}
     */
    accessibleProperties: string;
    /**
     * The copy as JSON text, to keep and give to a later engine.
     *
     * @returns {string} an object with evidenceKeys and accessibleProperties
     */
    toJson(): string;
}
