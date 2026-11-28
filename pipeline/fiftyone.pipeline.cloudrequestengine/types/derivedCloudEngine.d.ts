export = DerivedCloudEngine;
/**
 * The cloud engine for the derived product, which gives HumanConfidence and
 * HumanConfidenceSource. On a request that carries a sealed Human
 * Confidence result, the Cloud Request Engine redeems it, and this engine
 * gives the Value it redeemed to, or Medium where it was not redeemed, with
 * HumanConfidenceSource Active.
 *
 * Unlike the other cloud engines, it can be added to a Pipeline with no
 * Cloud Request Engine. Nothing is redeemed there, so it gives only the two
 * Properties: Medium and Active on a request that carries a sealed result,
 * and no value, with the reason, on any other request.
 */
declare class DerivedCloudEngine extends CloudEngine {
}
declare namespace DerivedCloudEngine {
    export { Pipeline, FlowElement, FlowData };
}
import CloudEngine = require("./cloudEngine");
type Pipeline = import("fiftyone.pipeline.core/types/pipeline");
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
type FlowData = import("fiftyone.pipeline.core/types/flowData");
