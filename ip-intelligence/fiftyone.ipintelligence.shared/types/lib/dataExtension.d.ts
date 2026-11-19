export = DataExtension;
declare class DataExtension {
    /**
     * Format a single value for human-readable output. Weighted values
     * (objects with 'value' and 'weight' entries) are formatted as
     * 'value' when the weight is 1, or 'value (xx.xx%)' otherwise.
     *
     * @param {*} item value to format
     * @returns {string} human readable form of the value
     */
    static formatValue(item: any): string;
    /**
     * Helper to get a human readable value of an aspect property value.
     * IP intelligence values are commonly lists of weighted values, which
     * are formatted as a comma separated list with weights where the
     * weight is not 1.
     *
     * @param {object} elementData the element data from a flow data
     * @param {string} propertyName name of the property to get
     * @returns {string} human readable value of the property
     */
    static getValueHelper(elementData: object, propertyName: string): string;
}
