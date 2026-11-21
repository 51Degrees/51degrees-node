export = ElementData;
/**
 * Stores information created by a flowElement based on flowData.
 * Stored in flowData. Element data is written only by the flow element that
 * provides it, or the flow elements that share it, and only while they
 * process. Once they have finished, a write through the element data, or
 * into the contents object a dictionary keeps its values in, throws.
 *
 * Element data may come from a pool, and go back to it when the flow data
 * that holds it is disposed. Keeping a reference to element data after its
 * flow data is disposed is not supported, because the pool may give the
 * instance to another request. Nothing checks for that on a read.
 */
declare class ElementData {
    /**
     * Constructor for elementData
     *
     * @param {object} options the options object
     * @param {FlowElement} options.flowElement the FlowElement this data
     * is part of
     * @throws {string} 'flowElement dataKey not found', when the FlowElement
     * has no data key
     */
    constructor({ flowElement }: {
        flowElement: FlowElement;
    });
    flowElement: import("./flowElement");
    /**
     * Returns the data to the state of a new instance, with no values and
     * open for writing, before a pool gives it to another request. Classes
     * inheriting from elementData that hold values override this and call
     * it.
     */
    reset(): void;
    /**
     * Internal get method for elementData to retrieve an element from it
     * called via the elementData's get method
     * This method is overriden by classes inheriting from elementData
     *
     * @param {string} key the key to retrieve a property value for
     */
    getInternal(key: string): void;
    /**
     * Looks for a key again ignoring its letter case, after getInternal found
     * nothing for the key as given, because property names are compared
     * ignoring case. Classes inheriting from elementData override this, and
     * this one finds nothing.
     *
     * @param {string} key the key to retrieve a property value for
     * @returns {*} the value, or undefined if there is none
     */
    getInternalIgnoringCase(key: string): any;
    /**
     * A wrapper that performs actions before passing on processing
     * (or skipping) the getInternal method. A key that finds nothing as given
     * is looked for again ignoring its letter case, so a read that found its
     * value before costs no more.
     *
     * @param {string} key the key to retrieve a property value for
     * @returns {FlowData} value
     * @throws {string} a message naming the property and the element, when
     * the data has no value for the key in any case
     */
    get(key: string): FlowData;
    /**
     * Adds a lazy property, whose value is the result of a task the Flow
     * Element starts while it processes, such as a call to another resource.
     * The task never reads the Flow Data. Readers wait for it with getAsync,
     * and the Pipeline waits for every task before processing finishes, so a
     * read once processing has finished has the value or the task's error.
     *
     * @param {string} key the property name
     * @param {Promise} task the work that gives the value
     * @throws {Error} once the flow elements that write the data have finished
     */
    addLazyProperty(key: string, task: Promise<any>): void;
    _lazy: any;
    /**
     * Whether the property is lazy, in any letter case.
     *
     * @param {string} key the property name
     * @returns {boolean} true if addLazyProperty added it
     */
    isLazyProperty(key: string): boolean;
    /**
     * Waits for the property's lazy task, where it has one, then gets the
     * value as get does. Every reader of a lazy property waits for the same
     * task, which runs once.
     *
     * @param {string} key the property name
     * @returns {Promise<*>} the value, or the task's error
     */
    getAsync(key: string): Promise<any>;
    /**
     * Waits for the tasks of every lazy property.
     *
     * @returns {Promise<boolean>} true once every task has given its value,
     * false once every task has finished and one or more failed
     */
    lazySettled(): Promise<boolean>;
    /**
     * Whether the data has a lazy property, whether or not its task has
     * finished.
     *
     * @returns {boolean} true once addLazyProperty has added a property
     */
    hasLazyProperties(): boolean;
    /**
     * Whether a lazy property's task has not yet finished.
     *
     * @returns {boolean} true while a task is running
     */
    hasPendingLazyProperties(): boolean;
    /**
     * Records the failure of each lazy property's task in the Flow Data's
     * errors, as an error of the Flow Element that provides this data, once
     * however many readers meet it. A reader that meets a failure while the
     * Flow Data is processed calls this, and the Pipeline calls it before
     * processing finishes.
     *
     * @param {FlowData} flowData the Flow Data being processed
     */
    recordLazyFailures(flowData: FlowData): void;
    /**
     * Return string value of property
     *
     * @param {string} key the key to retreive a property value for
     * @returns {string} value
     */
    getAsString(key: string): string;
    /**
     * Return float value of property
     *
     * @param {string} key the key to retreive a property value for
     * @returns {number} float value
     */
    getAsFloat(key: string): number;
    /**
     * Return int value of property
     *
     * @param {string} key the key to retreive a property value for
     * @returns {number} int value
     */
    getAsInteger(key: string): number;
}
declare namespace ElementData {
    export { FlowElement, FlowData };
}
type FlowElement = import("./flowElement");
type FlowData = import("./flowData");
