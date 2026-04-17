import { describe, expect, test } from 'vitest';

import { getGeometryBounds, isValidGeoJSON, roundCoordinates } from './helper';

describe('Test isValidGeoJSON()', () => {
  describe('Point (default geometry type)', () => {
    test('should return true for a valid Point', () => {
      expect(isValidGeoJSON('{"type":"Point","coordinates":[-122.4194,37.7749]}')).toBe(true);
    });

    test('should return true when geometryType is explicitly Point', () => {
      expect(isValidGeoJSON('{"type":"Point","coordinates":[-122.4194,37.7749]}', 'Point')).toBe(
        true,
      );
    });

    test('should return false when type does not match the expected geometryType', () => {
      expect(
        isValidGeoJSON('{"type":"LineString","coordinates":[[-122.4,37.7],[-122.3,37.8]]}'),
      ).toBe(false);
    });

    test('should return false for an empty string', () => {
      expect(isValidGeoJSON('')).toBe(false);
    });

    test('should return false for invalid JSON', () => {
      expect(isValidGeoJSON('not json')).toBe(false);
    });

    test('should return false when coordinates is missing', () => {
      expect(isValidGeoJSON('{"type":"Point"}')).toBe(false);
    });

    test('should return false when coordinates is not an array', () => {
      expect(isValidGeoJSON('{"type":"Point","coordinates":"invalid"}')).toBe(false);
    });

    test('should return false when value is a non-object JSON primitive', () => {
      expect(isValidGeoJSON('"Point"')).toBe(false);
    });

    test('should return false when value is a JSON null', () => {
      expect(isValidGeoJSON('null')).toBe(false);
    });
  });

  describe('LineString geometry type', () => {
    test('should return true for a valid LineString', () => {
      expect(
        isValidGeoJSON(
          '{"type":"LineString","coordinates":[[-122.4,37.7],[-122.3,37.8]]}',
          'LineString',
        ),
      ).toBe(true);
    });

    test('should return false when type is Point but geometryType is LineString', () => {
      expect(
        isValidGeoJSON('{"type":"Point","coordinates":[-122.4194,37.7749]}', 'LineString'),
      ).toBe(false);
    });
  });

  describe('Polygon geometry type', () => {
    test('should return true for a valid Polygon', () => {
      expect(
        isValidGeoJSON(
          '{"type":"Polygon","coordinates":[[[-122.4,37.7],[-122.3,37.8],[-122.5,37.9],[-122.4,37.7]]]}',
          'Polygon',
        ),
      ).toBe(true);
    });

    test('should return false when type is Point but geometryType is Polygon', () => {
      expect(isValidGeoJSON('{"type":"Point","coordinates":[-122.4194,37.7749]}', 'Polygon')).toBe(
        false,
      );
    });
  });
});

describe('Test roundCoordinates()', () => {
  test('should round Point coordinates', () => {
    expect(roundCoordinates([-122.41941234, 37.77491234], 4)).toEqual([-122.4194, 37.7749]);
  });

  test('should round LineString coordinates', () => {
    expect(
      roundCoordinates(
        [
          [-122.41941234, 37.77491234],
          [-122.41951234, 37.77501234],
        ],
        4,
      ),
    ).toEqual([
      [-122.4194, 37.7749],
      [-122.4195, 37.775],
    ]);
  });

  test('should round Polygon coordinates', () => {
    expect(
      roundCoordinates(
        [
          [
            [-122.41941234, 37.77491234],
            [-122.41951234, 37.77501234],
            [-122.41941234, 37.77491234],
          ],
        ],
        4,
      ),
    ).toEqual([
      [
        [-122.4194, 37.7749],
        [-122.4195, 37.775],
        [-122.4194, 37.7749],
      ],
    ]);
  });
});

describe('Test getGeometryBounds()', () => {
  test('should return null for a Point geometry', () => {
    expect(getGeometryBounds({ type: 'Point', coordinates: [-122.4194, 37.7749] })).toBeNull();
  });

  test('should return bounds for a LineString geometry', () => {
    expect(
      getGeometryBounds({
        type: 'LineString',
        coordinates: [
          [-122.4194, 37.7749],
          [-73.9857, 40.7484],
        ],
      }),
    ).toEqual([
      [37.7749, -122.4194],
      [40.7484, -73.9857],
    ]);
  });

  test('should return bounds for a Polygon geometry', () => {
    expect(
      getGeometryBounds({
        type: 'Polygon',
        coordinates: [
          [
            [-122.4194, 37.7749],
            [-73.9857, 40.7484],
            [-122.4194, 40.7484],
            [-122.4194, 37.7749],
          ],
        ],
      }),
    ).toEqual([
      [37.7749, -122.4194],
      [40.7484, -73.9857],
    ]);
  });

  test('should return null for a LineString with non-numeric coordinates', () => {
    expect(
      getGeometryBounds({
        type: 'LineString',
        coordinates: /** @type {any} */ ([
          [null, 37.7749],
          [-73.9857, 40.7484],
        ]),
      }),
    ).toBeNull();
  });
});
