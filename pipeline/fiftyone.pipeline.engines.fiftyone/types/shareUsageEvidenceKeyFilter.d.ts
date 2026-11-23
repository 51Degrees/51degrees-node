export = ShareUsageEvidenceKeyFilter;
declare const ShareUsageEvidenceKeyFilter_base: typeof import("fiftyone.pipeline.core/types/evidenceKeyFilter");
/**
 * The ShareUsageEvidenceKeyFilter decides which evidence the 51Degrees
 * ShareUsage service is sent. Headers are shared unless they are blocked,
 * cookies only when their names start with 51D_, whatever the settings,
 * session values only when their names start with 51D_, and every query
 * string and form parameter unless sharing them all is turned off, when only
 * those whose names start with 51D_ or are on the list to share are. Any
 * other evidence is shared.
 */
declare class ShareUsageEvidenceKeyFilter extends ShareUsageEvidenceKeyFilter_base {
    /**
     * Constructor for ShareUsageEvidenceKeyFilter
     *
     * @param {object} options options for filter
     * @param {string} options.cookie the name of the cookie that identifies
     * the session
     * @param {boolean} options.shareAllQueryStringParameters deprecated, and
     * has no effect
     * @param {Array<string>|null} options.queryWhitelist deprecated, and has
     * no effect
     * @param {Array<string>} [options.keptQueryParameters] query string
     * parameters kept for the usage sharing element's own use, being the
     * session id and sequence it reads, which are not otherwise shared
     * @param {Array<string>} options.headerBlacklist headers not to share
     * @param {boolean} options.includeSession whether the session cookie is
     * included
     * @param {boolean} options.shareAll whether all evidence is shared, apart
     * from the evidence that is never shared and the cookies whose names do
     * not start with 51D_
     */
    constructor({ cookie, shareAllQueryStringParameters, queryWhitelist, keptQueryParameters, headerBlacklist, includeSession, shareAll }?: {
        cookie: string;
        shareAllQueryStringParameters: boolean;
        queryWhitelist: Array<string> | null;
        keptQueryParameters?: Array<string>;
        headerBlacklist: Array<string>;
        includeSession: boolean;
        shareAll: boolean;
    }, ...args: any[]);
    keptQueryParameters: string[];
    blockedHttpHeaders: string[];
    cookie: string;
    includeSession: boolean;
    shareAll: boolean;
}
declare namespace ShareUsageEvidenceKeyFilter {
    /**
     * Whether a key is a query string or form parameter that may be shared when
     * a Flow Element of the Pipeline accepts it, being any 'query.' key that is
     * not one that is never shared.
     *
     * @param {string} key evidence key
     * @returns {boolean} true for such a key
     */
    function isParameter(key: string): boolean;
}
