/* *********************************************************************
 * This Original Work is copyright of 51 Degrees Mobile Experts Limited.
 * Copyright 2026 51 Degrees Mobile Experts Limited, Davidson House,
 * Forbury Square, Reading, Berkshire, United Kingdom RG1 3EU.
 *
 * This Original Work is licensed under the European Union Public Licence
 * (EUPL) v.1.2 and is subject to its terms as set out below.
 *
 * If a copy of the EUPL was not distributed with this file, You can obtain
 * one at https://opensource.org/licenses/EUPL-1.2.
 *
 * The 'Compatible Licences' set out in the Appendix to the EUPL (as may be
 * amended by the European Commission) shall be deemed incompatible for
 * the purposes of the Work and the provisions of the compatibility
 * clause in Article 5 of the EUPL shall not apply.
 *
 * If using the Work as, or as part of, a network application, by
 * including the attribution notice(s) required under Article 5 of the EUPL
 * in the end user terms of the application under an appropriate heading,
 * such notice(s) shall fulfill the requirements of that article.
 * ********************************************************************* */

const path = require('path');

const LRU = require(path.resolve(__dirname, '..', 'lru'));

/**
 * The keys the list holds, from the most recently used.
 *
 * @param {LRU} lru the cache to read
 * @returns {Array<string>} each node's key, in list order
 */
const listed = lru => {
  const keys = [];
  lru.forEach(node => keys.push(node.key));
  return keys;
};

test('writing a key the cache holds replaces its entry', () => {
  const lru = new LRU(3);
  lru.write('a', 1);
  lru.write('a', 2);
  expect(lru.size).toBe(1);
  expect(listed(lru)).toEqual(['a']);
  expect(lru.read('a')).toBe(2);
});

test('a rewritten key moves to the front', () => {
  const lru = new LRU(3);
  lru.write('a', 1);
  lru.write('b', 1);
  lru.write('a', 2);
  expect(listed(lru)).toEqual(['a', 'b']);
  lru.write('c', 1);
  lru.write('d', 1);
  expect(listed(lru)).toEqual(['d', 'c', 'a']);
});

test('a full cache whose keys are rewritten keeps working', () => {
  const lru = new LRU(3);
  for (let i = 0; i < 100; i++) {
    const key = 'k' + (i % 5);
    lru.write(key, i);
    lru.write(key, i);
    expect(lru.size).toBeLessThanOrEqual(3);
    expect(listed(lru)).toHaveLength(lru.size);
    expect(Object.keys(lru.cache).sort()).toEqual(listed(lru).sort());
  }
});
