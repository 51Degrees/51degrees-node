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
     * Answer a request to a client-side endpoint, the JSON endpoint or the
     * JavaScript endpoint, whose If-None-Match matches the ETag, without
     * processing it. Call this once the evidence is added and before the flow
     * data is processed, and process the request and call
     * writeClientSideResponse only when this returns false. The web
     * integration specification requires that a matching request is not
     * processed, and the ETag depends only on the evidence the request
     * supplied, so it is known before processing.
     *
     * @param {import('http').IncomingMessage} request the request
     * @param {import('http').ServerResponse} response the response, which this
     * ends when it returns true
     * @param {FlowData} flowData the flow data for the request, with its
     * evidence added and not yet processed
     * @param {object} [options] options
     * @param {number} [options.maxAgeSeconds] how long a browser may reuse the
     * response, 1800 unless given
     * @returns {boolean} true when the request matched and has been answered
     * with a 304 or a 412
     */
    static writeClientSideNotModified(request: import("http").IncomingMessage, response: import("http").ServerResponse, flowData: FlowData, options?: {
        maxAgeSeconds?: number;
    }): boolean;
    /**
     * Write the response of a client-side endpoint, the JSON endpoint or the
     * JavaScript endpoint, with the caching headers of the web integration
     * specification. A response to a request whose processing recorded errors
     * has Cache-Control private, no-cache and no ETag. A request whose
     * If-None-Match matches the ETag gets what writeClientSideNotModified
     * gives it, for a caller that processes every request before writing the
     * response, though such a request should not have been processed.
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
