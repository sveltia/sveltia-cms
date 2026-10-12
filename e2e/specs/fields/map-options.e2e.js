import { readFile } from 'fs/promises';

import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

/**
 * A guide to Tokyo with a Map field for each geometry type: a meeting point centred on Tokyo
 * Station with `center` and `zoom`, saved with 3 decimals, a walking route saved with 4, and an
 * area with the default precision of 7 decimals.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'static/uploads',
  collections: [
    {
      name: 'tours',
      label: 'Tours',
      label_singular: 'Tour',
      folder: 'content/tours',
      extension: 'yml',
      create: true,
      slug: '{{title}}',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'meeting_point',
          label: 'Meeting Point',
          widget: 'map',
          // `[longitude, latitude]`, like GeoJSON
          center: [139.7671, 35.6812],
          zoom: 15,
          decimals: 3,
          required: false,
        },
        {
          name: 'route',
          label: 'Route',
          widget: 'map',
          type: 'LineString',
          center: [139.7671, 35.6812],
          zoom: 10,
          decimals: 4,
          required: false,
        },
        {
          name: 'area',
          label: 'Area',
          widget: 'map',
          type: 'Polygon',
          required: false,
        },
      ],
    },
  ],
};

const { dependencies } = JSON.parse(
  await readFile(new URL('../../../package.json', import.meta.url), 'utf8'),
);

/**
 * URL the CMS loads Terra Draw from, which the Leaflet adapter has to import as well, so both share
 * one copy of the library.
 */
const TERRA_DRAW_URL = `https://unpkg.com/terra-draw@${dependencies['terra-draw'].replace(/^\D/, '')}/dist/terra-draw.module.js`;

/**
 * URL of a file of Leaflet, Terra Draw or its Leaflet adapter on UNPKG, capturing the package name
 * and the path of the file.
 */
const MODULE_URL_REGEX =
  /^https:\/\/unpkg\.com\/(leaflet|terra-draw|terra-draw-leaflet-adapter)@[^/]+\/([^?]+)/;

/**
 * An empty map tile.
 */
const TILE = createPNG({ size: 256, color: [221, 221, 221] });
/**
 * URLs of the map tiles the test has answered.
 * @type {string[]}
 */
let tileRequests = [];

test.use({ config: CONFIG, viewport: { width: 1280, height: 2000 } });

test.beforeEach(async ({ cms, context }) => {
  tileRequests = [];

  // Leaflet, Terra Draw and its Leaflet adapter are loaded from UNPKG on first use; serve the
  // copies installed with the CMS instead, so the tests don’t depend on the network
  await context.route(MODULE_URL_REGEX, async (route) => {
    const [, name, path] = /** @type {RegExpMatchArray} */ (
      route.request().url().match(MODULE_URL_REGEX)
    );

    const body = await readFile(new URL(`../../../node_modules/${name}/${path}`, import.meta.url));

    await route.fulfill({
      contentType: path.endsWith('.png') ? 'image/png' : 'text/javascript',
      headers: { 'Access-Control-Allow-Origin': '*' },
      // UNPKG’s `?module` rewrites the bare import of Terra Draw in the adapter
      body:
        name === 'terra-draw-leaflet-adapter'
          ? body.toString().replaceAll('from"terra-draw"', `from"${TERRA_DRAW_URL}"`)
          : body,
    });
  });
  // Never ask OpenStreetMap for the tiles: answer with an empty one, noting which was asked for
  await context.route('https://*.tile.openstreetmap.org/**', async (route) => {
    tileRequests.push(new URL(route.request().url()).pathname);
    await route.fulfill({ contentType: 'image/png', body: TILE });
  });

  await cms.open();
  await cms.signIn();
});

/**
 * Get the map of a field, once its drawing tools are ready to place a feature, which they show with
 * the crosshair cursor.
 * @param {Page} page Page.
 * @param {string} label Field label.
 * @returns {Promise<Locator>} Map.
 */
const getMap = async (page, label) => {
  const map = page
    .getByRole('group', { name: new RegExp(`^“.${label}.” Field$`) })
    .getByRole('application');

  await expect(map).toHaveCSS('cursor', 'crosshair');

  return map;
};

/**
 * Click a map at a distance from its centre.
 * @param {Locator} map Map.
 * @param {number} x Pixels to the right of the centre.
 * @param {number} y Pixels below the centre.
 */
const clickMap = async (map, x, y) => {
  const { width, height } = /** @type {{ width: number, height: number }} */ (
    await map.boundingBox()
  );

  await map.click({ position: { x: width / 2 + x, y: height / 2 + y } });
};

/**
 * Get the coordinates of the point a number of pixels away from a centre on a Web Mercator map,
 * like Leaflet’s.
 * @param {[number, number]} center Centre as `[longitude, latitude]`.
 * @param {number} zoom Zoom level.
 * @param {number} x Pixels to the right of the centre.
 * @param {number} y Pixels below the centre.
 * @returns {[number, number]} Coordinates as `[longitude, latitude]`.
 */
const getCoordinates = ([longitude, latitude], zoom, x, y) => {
  const scale = 256 * 2 ** zoom;
  const centerY = Math.log(Math.tan(Math.PI / 4 + (latitude * Math.PI) / 360)) / (2 * Math.PI);

  return [
    longitude + (x / scale) * 360,
    (Math.atan(Math.exp((centerY - y / scale) * 2 * Math.PI)) * 360) / Math.PI - 90,
  ];
};

/**
 * Get the number of decimals of a number.
 * @param {number} number Number.
 * @returns {number} Number of decimals.
 */
const countDecimals = (number) => String(number).split('.')[1]?.length ?? 0;

test('starts each map at the configured centre and zoom level', async ({ page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  await getMap(page, 'Meeting Point');
  await getMap(page, 'Route');
  await getMap(page, 'Area');

  // The tiles around Tokyo Station at zoom levels 15 and 10, and around the null island at the
  // default zoom level of 2
  await expect
    .poll(() => tileRequests)
    .toEqual(expect.arrayContaining(['/15/29105/12903.png', '/10/909/403.png', '/2/2/2.png']));
});

test('saves a point placed on the map with the configured precision', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Marunouchi');
  // The centre of the map is Tokyo Station, at 139.7671° E, 35.6812° N
  await clickMap(await getMap(page, 'Meeting Point'), 0, 0);
  // The preview shows the GeoJSON geometry
  await expect(page.getByRole('group', { name: 'Preview Content' })).toContainText(
    '{"type":"Point","coordinates":[139.767,35.681]}',
  );
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/tours/marunouchi.yml'])
    .toBe(
      [
        'title: Marunouchi',
        'meeting_point: \'{"type":"Point","coordinates":[139.767,35.681]}\'',
        "route: ''",
        "area: ''",
        '',
      ].join('\n'),
    );
});

test('saves a line and a polygon drawn on the map', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);

  await editor.getByRole('textbox', { name: 'Title' }).fill('Walk');

  // Clicking the last point again finishes the line
  const route = await getMap(page, 'Route');

  await clickMap(route, 0, 0);
  await clickMap(route, 100, 0);
  await clickMap(route, 100, 100);
  await clickMap(route, 100, 100);

  // Clicking the first point again closes the polygon
  const area = await getMap(page, 'Area');

  await clickMap(area, 0, 0);
  await clickMap(area, 100, 0);
  await clickMap(area, 100, 100);
  await clickMap(area, 0, 0);

  await editor.getByRole('button', { name: 'Save' }).click();
  await expect.poll(async () => (await cms.readRepo())['content/tours/walk.yml']).toBeDefined();

  const file = /** @type {string} */ ((await cms.readRepo())['content/tours/walk.yml']);

  const [, routeValue, areaValue] = /** @type {RegExpMatchArray} */ (
    file.match(/^route: '(.+)'\narea: '(.+)'$/m)
  );

  const line = JSON.parse(routeValue);
  const polygon = JSON.parse(areaValue);

  // The line runs through the clicked points, rounded to 4 decimals. A click can land a pixel or
  // two away from the point aimed at, about 0.003° at zoom level 10
  expect(line.type).toBe('LineString');
  expect(line.coordinates).toHaveLength(3);
  [
    [0, 0],
    [100, 0],
    [100, 100],
  ].forEach(([x, y], index) => {
    const [longitude, latitude] = line.coordinates[index];
    const [expectedLongitude, expectedLatitude] = getCoordinates([139.7671, 35.6812], 10, x, y);

    expect(longitude).toBeCloseTo(expectedLongitude, 2);
    expect(latitude).toBeCloseTo(expectedLatitude, 2);
    expect(countDecimals(longitude)).toBeLessThanOrEqual(4);
    expect(countDecimals(latitude)).toBeLessThanOrEqual(4);
  });

  // The polygon is a closed ring of the 3 clicked points, in the order Terra Draw winds them, with
  // up to 7 decimals by default. A pixel is about 0.35° at zoom level 2
  expect(polygon.type).toBe('Polygon');
  expect(polygon.coordinates).toHaveLength(1);

  const [ring] = polygon.coordinates;

  expect(ring).toHaveLength(4);
  expect(ring[3]).toEqual(ring[0]);
  [
    [0, 0],
    [100, 0],
    [100, 100],
  ].forEach(([x, y]) => {
    const [expectedLongitude, expectedLatitude] = getCoordinates([0, 0], 2, x, y);

    expect(
      ring
        .slice(0, 3)
        .some(
          (/** @type {number[]} */ [longitude, latitude]) =>
            Math.abs(longitude - expectedLongitude) < 1.5 &&
            Math.abs(latitude - expectedLatitude) < 1.5,
        ),
    ).toBe(true);
  });
  ring.flat().forEach((/** @type {number} */ coordinate) => {
    expect(countDecimals(coordinate)).toBeLessThanOrEqual(7);
  });
});

test.describe('current location', () => {
  test.use({
    permissions: ['geolocation'],
    geolocation: { latitude: 35.681236789, longitude: 139.767125432 },
  });

  test('rounds the current location to the configured precision', async ({ cms, page }) => {
    await page.getByRole('button', { name: 'Create New Entry' }).first().click();

    const editor = getEditor(page);

    await editor.getByRole('textbox', { name: 'Title' }).fill('Here');
    await getMap(page, 'Meeting Point');
    await getMap(page, 'Area');
    await page
      .getByRole('group', { name: /Meeting Point.* Field$/ })
      .getByRole('button', { name: 'Use Your Location' })
      .click();

    // A line or a polygon can’t be placed at a location, so the map only moves there
    const area = page.getByRole('group', { name: /Area.* Field$/ });

    await area.getByRole('button', { name: 'Use Your Location' }).click();
    await expect.poll(() => tileRequests).toContain('/15/29105/12903.png');
    await expect(area.getByRole('button', { name: 'Clear' })).toBeDisabled();
    await editor.getByRole('button', { name: 'Save' }).click();

    await expect
      .poll(async () => (await cms.readRepo())['content/tours/here.yml'])
      .toBe(
        [
          'title: Here',
          'meeting_point: \'{"type":"Point","coordinates":[139.767,35.681]}\'',
          "route: ''",
          "area: ''",
          '',
        ].join('\n'),
      );
  });
});

test('leaves the stored geometries as they are, until a field is cleared', async ({
  cms,
  page,
}) => {
  const path = 'content/tours/tower.yml';

  // The point has more decimals than the field saves, and spaces the CMS doesn’t write
  await cms.seed({
    [path]: [
      'title: Tower',
      'meeting_point: \'{"type": "Point", "coordinates": [139.74543, 35.65858]}\'',
      'route: \'{"type":"LineString","coordinates":[[139.74543,35.65858],[139.7671,35.6812]]}\'',
      'area: \'{"type":"Polygon","coordinates":[[[139.74,35.65],[139.77,35.65],[139.77,35.68],[139.74,35.65]]]}\'',
      '',
    ].join('\n'),
  });
  await page.reload();
  await page.getByRole('row', { name: /Tower/ }).click();

  const editor = getEditor(page);

  await getMap(page, 'Meeting Point');
  await getMap(page, 'Route');
  await getMap(page, 'Area');
  // The map of a point zooms in on it, at zoom level 15
  await expect.poll(() => tileRequests).toContain('/15/29103/12905.png');
  await expect(editor.getByRole('button', { name: 'Save' })).toBeDisabled();

  await page
    .getByRole('group', { name: /Meeting Point.* Field$/ })
    .getByRole('button', { name: 'Clear' })
    .click();
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())[path])
    .toBe(
      [
        'title: Tower',
        "meeting_point: ''",
        'route: \'{"type":"LineString","coordinates":[[139.74543,35.65858],[139.7671,35.6812]]}\'',
        'area: \'{"type":"Polygon","coordinates":[[[139.74,35.65],[139.77,35.65],[139.77,35.68],[139.74,35.65]]]}\'',
        '',
      ].join('\n'),
    );
});
