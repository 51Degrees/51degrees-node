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

/**
 * Helpers used to work out the common values for geographic areas in the
 * examples. The 'Areas' property of the IP intelligence engine returns a
 * Well-Known Text (WKT) string containing one or more polygons. These
 * helpers parse the WKT, calculate the geodesic area covered, and test
 * whether a point falls within the area.
 *
 * The area calculation uses the spherical approximation described by
 * Chamberlain and Duquette (JPL Publication 07-3), which is the same
 * approach used by libraries such as turf.js. This avoids any third party
 * dependencies whilst remaining accurate enough for comparison purposes.
 */

// Mean radius of the earth in meters.
const EARTH_RADIUS_M = 6371008.8;

const toRadians = function (degrees) {
  return degrees * Math.PI / 180;
};

/**
 * Parse the coordinate list of a single ring. For example
 * '1.5 2.5, 3.5 4.5, 1.5 2.5' becomes [[1.5, 2.5], [3.5, 4.5], [1.5, 2.5]].
 *
 * @param {string} text coordinate list of a ring without parentheses
 * @returns {Array<Array<number>>} array of [longitude, latitude] pairs
 */
const parseRing = function (text) {
  return text.split(',').map(function (pair) {
    const parts = pair.trim().split(/\s+/);
    return [parseFloat(parts[0]), parseFloat(parts[1])];
  });
};

/**
 * Split a string on commas that are not contained within parentheses.
 *
 * @param {string} text the text to split
 * @returns {Array<string>} the parts of the text
 */
const splitTopLevel = function (text) {
  const parts = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '(') depth++;
    else if (c === ')') depth--;
    else if (c === ',' && depth === 0) {
      parts.push(text.substring(start, i));
      start = i + 1;
    }
  }
  parts.push(text.substring(start));
  return parts;
};

/**
 * Remove one set of enclosing parentheses from the text.
 *
 * @param {string} text the text to strip
 * @returns {string} the text without the outer parentheses
 */
const stripParentheses = function (text) {
  text = text.trim();
  if (text.startsWith('(') && text.endsWith(')')) {
    return text.substring(1, text.length - 1);
  }
  return text;
};

/**
 * Parse a WKT string into an array of polygons. Each polygon is an array
 * of rings where the first ring is the outer boundary and any further
 * rings are holes. Each ring is an array of [longitude, latitude] pairs.
 * POLYGON, MULTIPOLYGON, and GEOMETRYCOLLECTION geometries are supported.
 * Other geometry types (such as POINT) have no area and are returned as
 * empty polygon entries so that they are still counted as geometries.
 *
 * @param {string} wkt the WKT string to parse
 * @returns {Array<Array<Array<Array<number>>>>} array of polygons
 */
const parseWkt = function (wkt) {
  const polygons = [];
  wkt = wkt.trim();
  const upper = wkt.toUpperCase();
  if (upper.startsWith('POLYGON')) {
    const body = stripParentheses(wkt.substring('POLYGON'.length));
    polygons.push(splitTopLevel(body).map(function (ring) {
      return parseRing(stripParentheses(ring));
    }));
  } else if (upper.startsWith('MULTIPOLYGON')) {
    const body = stripParentheses(wkt.substring('MULTIPOLYGON'.length));
    for (const polygon of splitTopLevel(body)) {
      polygons.push(splitTopLevel(stripParentheses(polygon))
        .map(function (ring) {
          return parseRing(stripParentheses(ring));
        }));
    }
  } else if (upper.startsWith('GEOMETRYCOLLECTION')) {
    const body = stripParentheses(
      wkt.substring('GEOMETRYCOLLECTION'.length));
    for (const geometry of splitTopLevel(body)) {
      for (const polygon of parseWkt(geometry)) {
        polygons.push(polygon);
      }
    }
  } else {
    // Geometry without an area, for example POINT or LINESTRING.
    polygons.push([]);
  }
  return polygons;
};

/**
 * Returns the geodesic area of a ring in square meters. The result is
 * unsigned, so the winding order of the ring does not matter.
 *
 * @param {Array<Array<number>>} ring array of [longitude, latitude] pairs
 * @returns {number} area in square meters
 */
const ringArea = function (ring) {
  let total = 0;
  if (ring.length > 2) {
    for (let i = 0; i < ring.length; i++) {
      const p1 = ring[i];
      const p2 = ring[(i + 1) % ring.length];
      const p3 = ring[(i + 2) % ring.length];
      total += (toRadians(p3[0]) - toRadians(p1[0])) *
        Math.sin(toRadians(p2[1]));
    }
    total = total * EARTH_RADIUS_M * EARTH_RADIUS_M / 2;
  }
  return Math.abs(total);
};

/**
 * Returns the area of a polygon in square meters. This is the area of the
 * outer ring minus the area of any holes.
 *
 * @param {Array<Array<Array<number>>>} polygon array of rings
 * @returns {number} area in square meters
 */
const polygonArea = function (polygon) {
  let area = 0;
  if (polygon.length > 0) {
    area = ringArea(polygon[0]);
    for (let i = 1; i < polygon.length; i++) {
      area -= ringArea(polygon[i]);
    }
  }
  return area;
};

/**
 * Returns true if the point is inside the ring using the ray casting
 * algorithm.
 *
 * @param {Array<number>} point [longitude, latitude] pair
 * @param {Array<Array<number>>} ring array of [longitude, latitude] pairs
 * @returns {boolean} true if the point is inside the ring
 */
const pointInRing = function (point, ring) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    if (((yi > point[1]) !== (yj > point[1])) &&
      (point[0] < (xj - xi) * (point[1] - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
};

/**
 * Returns true if the point is inside the polygon. The point must be
 * inside the outer ring and outside all the holes.
 *
 * @param {Array<number>} point [longitude, latitude] pair
 * @param {Array<Array<Array<number>>>} polygon array of rings
 * @returns {boolean} true if the point is inside the polygon
 */
const pointInPolygon = function (point, polygon) {
  if (polygon.length === 0 || pointInRing(point, polygon[0]) === false) {
    return false;
  }
  for (let i = 1; i < polygon.length; i++) {
    if (pointInRing(point, polygon[i])) {
      return false;
    }
  }
  return true;
};

/**
 * Returns the result for the WKT string and geographic point. This is the
 * equivalent of the Calculations.GetAreas method in the .NET examples.
 *
 * @param {string} wkt WKT format geometric area(s)
 * @param {number} latitude of the point being tested for inclusion
 * @param {number} longitude of the point being tested for inclusion
 * @returns {object} object with squareKms, geometries, and contains
 * entries
 */
const getAreas = function (wkt, latitude, longitude) {
  const polygons = parseWkt(wkt);
  let area = 0;
  let contains = false;
  for (const polygon of polygons) {
    area += polygonArea(polygon);
    if (contains === false &&
      pointInPolygon([longitude, latitude], polygon)) {
      contains = true;
    }
  }
  return {
    // The total area in square kms.
    squareKms: Math.round(area / 1000000),
    // Number of polygons in the area.
    geometries: polygons.length,
    // Whether the geographic area contains the point.
    contains
  };
};

/**
 * Returns the distance in kilometers between two points using the
 * haversine formula.
 *
 * @param {number} latitudeA of the first point
 * @param {number} longitudeA of the first point
 * @param {number} latitudeB of the second point
 * @param {number} longitudeB of the second point
 * @returns {number} distance in kilometers
 */
const distanceKms = function (latitudeA, longitudeA, latitudeB, longitudeB) {
  const dLat = toRadians(latitudeB - latitudeA);
  const dLon = toRadians(longitudeB - longitudeA);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(latitudeA)) * Math.cos(toRadians(latitudeB)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a)) / 1000;
};

module.exports = {
  parseWkt,
  getAreas,
  distanceKms
};
