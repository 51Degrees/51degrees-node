export = EvidenceKeyFilter;
/**
 * An evidence key filter is added to a flowElement
 * It tells the pipeline which evidence it is interested in
 * This can be used to determine whether a request can be cached
 * Or to filter out evidence not needed by any element in a pipeline
 * This base class is always extended for a specific filter type
 */
declare class EvidenceKeyFilter {
    /**
     * Filter an evidence object
     *
     * @param {object} evidenceKeyObject key value object of evidence
     * @returns {object} filtered evidence object
     */
    filterEvidence(evidenceKeyObject: object): object;
    /**
     * Internal filterEvidenceKey function overriden
     *  by specific filters to keep or filter out a piece of evidence
     *
     * @param {string} key the evidence key to check
     * @returns {boolean} whether the key should stay or not
     */
    filterEvidenceKey(key: string): boolean;
}
