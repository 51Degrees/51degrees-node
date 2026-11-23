/**
 * The message for an answer from the cloud that lacks something a test
 * needs, naming the product a key needs to get it.
 *
 * @param {string} thing what the answer lacks
 * @param {string} reason the cloud's nullreason, if it gave one
 * @param {string} product the product a key needs for the thing
 * @returns {string} the message
 */
export function missingFromAnswerMessage(thing: string, reason: string, product: string): string;
export declare function getResourceKey(name: string): string;
export declare function missingResourceKeyMessage(name: string, products: string | Array<string>, asksFor: string, plural?: boolean): string;
export declare function requireProduct(cloudRequestEngine: object, product: string): Promise<void>;
export declare function isInvalidKey(keyValue: string): boolean;
