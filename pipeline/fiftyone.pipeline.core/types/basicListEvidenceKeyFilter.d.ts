export = BasicListEvidenceKeyFilter;
/**
 * An instance of evidenceKeyFilter that uses a simple array of keys
 * Evidence not using these keys is filtered out
 */
declare class BasicListEvidenceKeyFilter extends EvidenceKeyFilter {
    /**
     * constructor for basicListEvidenceKeyFilter
     *
     * @param {Array} list items to keep when filtering
     */
    constructor(list: any[]);
    list: any[];
}
import EvidenceKeyFilter = require("./evidenceKeyFilter");
