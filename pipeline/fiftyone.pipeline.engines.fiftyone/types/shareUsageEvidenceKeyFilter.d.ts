export = ShareUsageEvidenceKeyFilter;
declare const ShareUsageEvidenceKeyFilter_base: typeof import("fiftyone.pipeline.core/types/evidenceKeyFilter");
/**
 * The ShareUsageEvidenceKeyFilter decides which evidence the 51Degrees
 * ShareUsage service is sent. Headers are shared unless they are blocked,
 * cookies and session values only when their names start with 51D_, and
 * query string and form parameters only when their names start with 51D_ or
 * are on the list to share. Any other evidence is shared.
 */
declare class ShareUsageEvidenceKeyFilter extends ShareUsageEvidenceKeyFilter_base {
    /**
     * Constructor for ShareUsageEvidenceKeyFilter
     *
     * @param {object} options options for filter
     * @param {string} options.cookie the name of the cookie that identifies
     * the session
     * @param {Array<string>|null} options.queryWhitelist query string and
     * form parameters to share as well as those starting 51D_, or null to
     * share every parameter
     * @param {Array<string>} options.headerBlacklist headers not to share
     * @param {boolean} options.includeSession whether the session cookie is
     * included
     * @param {boolean} options.shareAll whether all evidence is shared, apart
     * from the evidence that is never shared
     */
    constructor({ cookie, queryWhitelist, headerBlacklist, includeSession, shareAll }?: {
        cookie: string;
        queryWhitelist: Array<string> | null;
        headerBlacklist: Array<string>;
        includeSession: boolean;
        shareAll: boolean;
    }, ...args: any[]);
    includedQueryStringParams: string[];
    blockedHttpHeaders: string[];
    cookie: string;
    includeSession: boolean;
    shareAll: boolean;
}
