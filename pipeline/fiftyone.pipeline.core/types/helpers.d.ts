export = Helpers;
declare class Helpers {
    /**
     * Set response headers in the response object (e.g. Accept-CH)
     *
     * @param {import('http').ServerResponse} response The response to set the headers in.
     * @param {FlowData} flowData A processed FlowData instance to get the response header values
     * from.
     */
    static setResponseHeaders(response: import("http").ServerResponse, flowData: FlowData): void;
    /**
     * Write the response of a client-side endpoint, the JSON endpoint or the
     * JavaScript endpoint, with the caching headers of the web integration
     * specification. A request whose If-None-Match matches the ETag gets a 304
     * when it is a GET or HEAD and a 412 otherwise, as RFC 9110 section 13.1.2
     * requires. A response to a request whose processing recorded errors has
     * Cache-Control private, no-cache and no ETag, though a matching
     * If-None-Match still gets its 304.
     *
     * @param {import('http').IncomingMessage} request the request
     * @param {import('http').ServerResponse} response the response, which this
     * ends
     * @param {FlowData} flowData the processed flow data for the request
     * @param {string} contentType the content type of the body
     * @param {string} body the JSON or the JavaScript
     * @param {object} [options] options
     * @param {number} [options.maxAgeSeconds] how long a browser may reuse the
     * response, 1800 unless given
     */
    static writeClientSideResponse(request: import("http").IncomingMessage, response: import("http").ServerResponse, flowData: FlowData, contentType: string, body: string, options?: {
        maxAgeSeconds?: number;
    }): void;
}
declare namespace Helpers {
    export { FlowData };
}
type FlowData = import("./flowData");
