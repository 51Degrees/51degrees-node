export = DerivedCloudEngine;
/**
 * The cloud engine for the derived product, which gives HumanConfidence and
 * HumanConfidenceSource. On a request that carries a sealed Human
 * Confidence result, the Cloud Request Engine redeems it, and this engine
 * gives the Value it redeemed to, or Medium where it was not redeemed, with
 * HumanConfidenceSource Active.
 */
declare class DerivedCloudEngine extends CloudEngine {
}
import CloudEngine = require("./cloudEngine");
