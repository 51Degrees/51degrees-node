export let IpIntelligenceOnPremise: typeof import("./ipIntelligenceOnPremise");
export let IpIntelligenceOnPremisePipelineBuilder: typeof import("./ipIntelligenceOnPremisePipelineBuilder");
export let SwigData: typeof import("./swigData");
export let swigHelpers: {
    vectorToArray: (vector: object) => any[];
    weightedVectorToArray: (vector: object) => any[];
    swigDateToDate: (swigDate: object) => Date;
};
