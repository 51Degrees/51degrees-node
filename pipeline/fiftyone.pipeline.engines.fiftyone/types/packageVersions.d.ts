export = packageVersions;
/**
 * The 51Degrees packages a Pipeline uses, each once: the package that holds
 * the Pipeline, the package that holds each of its Flow Elements and every
 * 51Degrees package those depend on.
 *
 * @param {Array<object>} flowElements the Flow Elements of the Pipeline
 * @returns {Array<{name: string, version: string}>} the packages, ordered by
 * name
 */
declare function packageVersions(flowElements: Array<object>): Array<{
    name: string;
    version: string;
}>;
