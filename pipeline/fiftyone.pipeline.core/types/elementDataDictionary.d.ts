export = ElementDataDictionary;
/**
 * @typedef {import('./flowElement')} FlowElement
 */
/**
 * A basic extension of elementData with dictionary object storage / lookup
 **/
declare class ElementDataDictionary extends ElementData {
    /**
     * Constructor for ElementDataDictionary
     *
     * @param {object} options options object
     * @param {FlowElement} options.flowElement FlowElement the options are
     * added to
     * @param {object} options.contents // key value dictionary
     */
    constructor({ flowElement, contents }: {
        flowElement: FlowElement;
        contents: object;
    }, ...args: any[]);
    contents: object;
    /**
     * Return value from elementData dictionary. Property names are compared
     * ignoring case, so a key that is not in the dictionary as given is looked
     * for in any letter case. The contents can change after the data is made,
     * so they are searched on that miss rather than indexed once.
     *
     * @param {string} key the property key to retrieve
     * @returns {*} the value, or undefined if there is none
     */
    getInternal(key: string): any;
    [Symbol.iterator](): Generator<string, void, unknown>;
}
declare namespace ElementDataDictionary {
    export { FlowElement };
}
import ElementData = require("./elementData");
type FlowElement = import("./flowElement");
