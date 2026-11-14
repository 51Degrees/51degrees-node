export = OptionsExtension;
declare class OptionsExtension {
    /**
     * Get the element with the given name from the pipeline options
     *
     * @param {object} options pipeline options
     * @param {string} elementName name of the element to get
     * @returns {object} the element or undefined if not found
     */
    static getElement(options: object, elementName: string): object;
    /**
     * Get the data file path from the pipeline options
     *
     * @param {object} options pipeline options
     * @returns {string} the data file path or undefined if not set
     */
    static getDataFilePath(options: object): string;
    /**
     * Set the data file path in the pipeline options
     *
     * @param {object} options pipeline options
     * @param {string} newDataFilePath the new data file path
     * @returns {void}
     */
    static setDataFilePath(options: object, newDataFilePath: string): void;
    /**
     * Update relative element paths by prepending the supplied directory
     *
     * @param {object} options pipeline options
     * @param {string} appendDir directory to prepend to relative paths
     * @returns {void}
     */
    static updateElementPath(options: object, appendDir: string): void;
    /**
     * Get the resource key from the pipeline options
     *
     * @param {object} options pipeline options
     * @returns {string} the resource key or undefined if not set
     */
    static getResourceKey(options: object): string;
    /**
     * Set the resource key in the pipeline options
     *
     * @param {object} options pipeline options
     * @param {string} resourceKey the new resource key
     * @returns {void}
     */
    static setResourceKey(options: object, resourceKey: string): void;
}
