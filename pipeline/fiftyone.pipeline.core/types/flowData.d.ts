export = FlowData;
/**
 * FlowData is created by a specific pipeline
 * It collects evidence set by the user
 * It passes evidence to flowElements in the pipeline
 * These elements can return ElementData or populate an errors object
 */
declare class FlowData {
    /**
     * constructor for flowData created by a pipeline.
     * Called by a pipeline's createFlowData() method
     *
     * @param {Pipeline} pipeline the pipeline to add the FlowData to
     */
    constructor(pipeline: Pipeline);
    pipeline: import("./pipeline");
    evidence: Evidence;
    errors: {};
    stopped: boolean;
    processing: boolean;
    processed: boolean;
    elementDataHead: any;
    /**
     * Get back an object that lists all evidence that will be
     * used by any flowElements in the flowData's parent pipeline
     *
     * @returns {object} Evidence that is requested by flowElements
     */
    getEvidenceDataKey(): object;
    /**
     * Stop a flowData from processing any further flowElements
     */
    stop(): void;
    /**
     * Set an error on the flowData (usually triggered by
     * something going wrong in a flowElement's process function)
     *
     * @param {*} error the error to throw
     * @param {FlowElement} flowElement the FlowElement the error is thrown on
     * @throws {Error} once the flow data has finished processing
     */
    setError(error: any, flowElement: FlowElement): void;
    /**
     * Processes the flowData (running the process methods on all connected)
     *
     * @returns {Promise} result of processing. Once processing has finished,
     * the promise rejects with an AggregateError holding every error recorded
     * in flowData.errors, unless the pipeline suppresses process exceptions.
     */
    process(): Promise<any>;
    /**
     * Throws once processing has finished, because a finished flow data is
     * read only. Every method that writes to the flow data calls this first.
     *
     * @param {string} what what is being added, for the message
     * @throws {Error} once processing has finished
     */
    checkNotFinished(what: string): void;
    /**
     * Add to the flowData object with a class derived from ElementData
     *
     * @param {ElementData} data instance of ElementData to
     * set for the FlowElement's datakey
     * @returns {FlowData} the FlowData object
     * @throws {Error} once the flow data has finished processing
     */
    setElementData(data: ElementData): FlowData;
    /**
     * The ElementData under a FlowElement's data key, or undefined if there
     * is none. Data added later under the same key replaces the earlier, and
     * a key that finds nothing as given is looked for again ignoring its
     * letter case.
     *
     * @param {string} flowElementDataKey the datakey of a FlowElement
     * @returns {ElementData|undefined} data from the FlowElement
     */
    tryGet(flowElementDataKey: string): ElementData | undefined;
    /**
     * Every ElementData in the FlowData, in Pipeline order, being the order
     * the FlowElements were added to the Pipeline, with the members of a
     * parallel group in the group's place. Data under a key no FlowElement
     * of the Pipeline has comes last, in the order it was added.
     *
     * @returns {ElementData[]} the ElementData
     */
    listElementData(): ElementData[];
    /**
     * The ElementData by data key, in Pipeline order. Deprecated, as the
     * FlowData keeps its ElementData in a list, and this object is made
     * from the list each time it is read. Use get, tryGet or
     * listElementData instead.
     *
     * @deprecated
     * @returns {object} the ElementData by data key
     */
    get data(): object;
    /**
     * Get ElementData by a flowElement's data key
     *
     * @param {string} flowElementDataKey the datakey of a FlowElement
     * @returns {ElementData} data from the FlowElement
     * @throws {string} a message naming the data key and the data keys there
     * are, when no element has given data under the key in any case
     */
    get(flowElementDataKey: string): ElementData;
    /**
     * get ElementData by a FlowElement object
     *
     * @param {FlowElement} flowElement The FlowElement to fetch data for
     * @returns {ElementData} data from the FlowElement
     */
    getFromElement(flowElement: FlowElement): ElementData;
    /**
     * get an object ({key:value} store) of elementData
     * based on a metadata key and value, alternatively
     * pass in a filtering function to manually filter available propeties
     *
     * @param {string} metaKey a metakey such as "category"
     * @param {string|Function} metaValueorFuncton value or a filter
     * function which receives the value of the metaKey and returns a boolean
     * @returns {object} key value pair of matching properties and values
     */
    getWhere(metaKey: string, metaValueorFuncton: string | Function): object;
}
declare namespace FlowData {
    export { Pipeline, FlowElement, ElementData };
}
import Evidence = require("./evidence");
type Pipeline = import("./pipeline");
type FlowElement = import("./flowElement");
type ElementData = import("./elementData");
