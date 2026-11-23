export = MissingPropertyService;
/**
 * Base class for a missing property service that throws
 * an error if the property is not available for some reason
 **/
declare class MissingPropertyService {
    /**
     * Check is called if a property is requested that exists
     * in the FlowElement property list but is not available
     * in the AspectData returned by the FlowElement. It throws the message
     * for the reason, decided in the order the specification gives.
     *
     * @param {string} key property key
     * @param {FlowElement} flowElement flowelement the data
     * was requested in
     * @throws {string} the message saying why the Property is missing
     */
    check(key: string, flowElement: FlowElement): void;
    /**
     * The data tiers that have a Property the metadata lists, where the
     * engine's data file is not one of them. A service for an on-premise
     * engine whose data files come in tiers gives them, and this one gives
     * none, so the Property is taken to be excluded.
     *
     * @param {object} property the Property's metadata
     * @param {FlowElement} flowElement the engine the Property was asked of
     * @returns {string[] | undefined} the tiers that have the Property, or
     * undefined where the engine's data file has it
     */
    tiersWithProperty(property: object, flowElement: FlowElement): string[] | undefined;
    /**
     * Return true if the supplied flow element is a CloudEngine, false if not.
     *
     * @param {FlowElement} flowElement The flow element to check
     * @returns {boolean} Is CloudEngine
     */
    _isCloudEngine(flowElement: FlowElement): boolean;
}
declare namespace MissingPropertyService {
    export { FlowElement };
}
type FlowElement = import("fiftyone.pipeline.core/types/flowElement");
