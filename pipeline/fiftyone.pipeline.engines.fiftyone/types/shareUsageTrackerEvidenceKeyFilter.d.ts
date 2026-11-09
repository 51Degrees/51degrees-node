export = ShareUsageTrackerEvidenceKeyFilter;
/**
 * The evidence the ShareUsageTracker compares to decide whether a request
 * repeats one already shared. The session id and sequence number are left
 * out, because they make every request different.
 */
declare class ShareUsageTrackerEvidenceKeyFilter extends ShareUsageEvidenceKeyFilter {
}
import ShareUsageEvidenceKeyFilter = require("./shareUsageEvidenceKeyFilter");
