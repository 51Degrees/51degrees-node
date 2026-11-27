export = listSetting;
/**
 * Reads a setting that holds a list of strings. Code gives the list itself,
 * and a configuration file gives one comma separated string, as
 * https://github.com/51Degrees/specifications/blob/main/pipeline-specification/features/pipeline-configuration.md
 * says for every language.
 *
 * A string with no items is taken as not set, because an empty list
 * restricts an engine to no properties.
 *
 * @param {Array<string>|string|null|undefined} value the setting
 * @returns {Array<string>|null|undefined} the list given, or the items of
 * the string, each without the space around it and leaving out empty ones,
 * or the value itself when it is not set
 */
declare function listSetting(value: Array<string> | string | null | undefined): Array<string> | null | undefined;
