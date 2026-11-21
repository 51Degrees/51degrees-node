export = ElementDataPool;
/**
 * @typedef {import('./elementData')} ElementData
 */
/**
 * A bounded pool of Element Data, so a Flow Element reuses instances rather
 * than making one for every request. An instance goes back to its pool when
 * the Flow Data that holds it is disposed and its processing has finished,
 * unless a cache holds it, as the cache shares it with other requests.
 * Keeping a reference to Element Data after its Flow Data is disposed is not
 * supported, because the pool may give the instance to another request.
 * Nothing checks for that when the Element Data is read.
 */
declare class ElementDataPool {
    /**
     * Marks an instance as shared with other requests, such as one a cache
     * holds, so it never goes back to a pool.
     *
     * @param {ElementData} data the instance
     */
    static share(data: ElementData): void;
    /**
     * Gives an instance back to the pool it came from, unless it came from
     * none or is shared with other requests.
     *
     * @param {ElementData} data the instance
     */
    static release(data: ElementData): void;
    /**
     * Constructor for ElementDataPool
     *
     * @param {object} [options] options for the pool
     * @param {number} [options.size] the most instances the pool keeps
     */
    constructor({ size }?: {
        size?: number;
    });
    maxSize: number;
    free: any[];
    /**
     * The number of instances made because the pool had none to give.
     *
     * @type {number}
     */
    created: number;
    /**
     * The number of instances the pool holds now.
     *
     * @returns {number} the number of instances held
     */
    get size(): number;
    /**
     * An instance from the pool with no values and open for writing, or a
     * new one from create when the pool is empty.
     *
     * @param {function(): ElementData} create makes a new instance
     * @returns {ElementData} the instance
     */
    take(create: () => ElementData): ElementData;
    /**
     * Keeps an instance for a later take, unless the pool is full.
     *
     * @param {ElementData} data the instance
     */
    give(data: ElementData): void;
}
declare namespace ElementDataPool {
    export { ElementData };
}
type ElementData = import("./elementData");
