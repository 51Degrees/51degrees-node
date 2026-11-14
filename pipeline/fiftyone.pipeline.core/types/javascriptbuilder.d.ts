export = JavaScriptBuilderElement;
/**
 * The JavaScriptBuilder aggregates JavaScript properties
 * from FlowElements in the pipeline. This JavaScript also
 * (when needed) generates a fetch request to retrieve additional properties
 * populated with data from the client side
 * It depends on the JSON Bundler element
 * (both are automatically added to a pipeline unless
 * specifically removed) for its list of properties.
 * The results of the JSON Bundler should also be used in a
 * user-specified endpoint which retrieves the JSON from the
 * client side. The JavaScriptBuilder is constructed with a
 * url for this endpoint.
 */
declare class JavaScriptBuilderElement extends FlowElement {
    /**
     * Constructor for JavaScriptBuilder.
     *
     * @param {object} options options object
     * @param {string} options.objName the name of the client
     * side object with the JavaScript properties in it. This must be a valid
     * JavaScript identifier that is not a reserved word, or the constructor
     * throws. Leaving it out, or giving null, means "fod". This can be overridden with "query.fod-js-object-name" evidence,
     * which is ignored with a warning when it is not a valid name.
     * @param {string} options.protocol The protocol of the client side
     * callback url, http or https in any case of its ASCII letters. The
     * constructor throws for any other protocol. Left out, the header.protocol
     * evidence is used, or https when there is none
     * @param {string} options.host The host of the client side
     * callback url. This can be overriden with header.host evidence.
     * @param {string} options.endPoint The endpoint of the client side
     * callback url
     * @param {boolean} options.enableCookies Whether the client JavaScript
     * stored results of client side processing in cookies. This can also
     * be set per request, using the "query.fod-js-enable-cookies" evidence key.
     * For more details on personal data policy, see https://51degrees.com/terms/client-services-privacy-policy/?utm_source=code&utm_medium=comment&utm_campaign=51degrees-node&utm_content=fiftyone.pipeline.core-javascriptbuilder.js&utm_term=constructor
     * @param {boolean} options.minify Whether to minify the JavaScript
     */
    constructor({ objName, protocol, host, endPoint, enableCookies, minify }?: {
        objName: string;
        protocol: string;
        host: string;
        endPoint: string;
        enableCookies: boolean;
        minify: boolean;
    }, ...args: any[]);
    settings: {
        objName: string;
        protocol: string;
        host: string;
        endPoint: string;
        enableCookies: boolean;
        minify: boolean;
    };
    evidenceKeyFilter: JSEvidenceKeyFilter;
    _invalidUrlLogged: boolean;
    /**
     * Internal process function of the JavaScript builder
     * Gets JSON from the JSONBundler and constructs JavaScript
     * to place on the client side
     *
     * @param {FlowData} flowData to process
     * @returns {undefined}
     */
    processInternal(flowData: FlowData): undefined;
}
declare namespace JavaScriptBuilderElement {
    export { FlowData };
}
import FlowElement = require("./flowElement.js");
/**
 * @typedef {import('./flowData')} FlowData
 */
/**
 * The script reads the query string, and the host and protocol it calls
 * back to, so those are the evidence that can change it.
 */
declare class JSEvidenceKeyFilter extends EvidenceKeyFilter {
    filterEvidenceKey(key: any): boolean;
}
type FlowData = import("./flowData");
import EvidenceKeyFilter = require("./evidenceKeyFilter.js");
