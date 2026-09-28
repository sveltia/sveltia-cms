import { MEDIA_CONFIG, MEDIA_FILES } from '../../fixtures/configs/media.js';
import { expect, test } from '../../fixtures/test.js';

import { getBottomNavigation, PHONE, signIn } from './helpers.js';

/**
 * @import { Locator, Page } from '@playwright/test';
 */

test.use({ config: MEDIA_CONFIG, ...PHONE });

test.beforeEach(async ({ cms, page }) => {
  await cms.open();
  await cms.seed(MEDIA_FILES);
  await signIn(page);
  await getBottomNavigation(page).getByRole('radio', { name: 'Assets' }).click();
});

/**
 * Swipe sideways across an element with one finger. `page.touchscreen` can only tap, so the touch
 * events are sent through the Chrome DevTools Protocol.
 * @param {Page} page Page.
 * @param {Locator} target Element to swipe across.
 * @param {number} distance Horizontal distance in pixels: negative to the left, positive to the
 * right.
 */
const swipe = async (page, target, distance) => {
  const box = /** @type {{ x: number, y: number, width: number, height: number }} */ (
    await target.boundingBox()
  );

  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;

  // While the page transition that opened the element runs, the browser hit-tests the document
  // element instead, so a touch then would miss the element; wait for the element to be hit
  await expect
    .poll(() =>
      target.evaluate(
        (element, point) => {
          const hit = document.elementFromPoint(point.x, point.y);

          return !!hit && element.contains(hit);
        },
        { x, y },
      ),
    )
    .toBe(true);

  const cdp = await page.context().newCDPSession(page);

  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + distance / 2, y }],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [{ x: x + distance, y }],
  });
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await cdp.detach();
};

test('moves between the folder list, a folder and an asset', async ({ page }) => {
  const folderList = page.getByRole('listbox', { name: 'Asset Folder List' });

  // The folder list fills the page, with a search bar of its own
  await expect(page).toHaveURL(/#\/assets$/);
  await expect(
    page.getByRole('navigation', { name: 'Assets' }).getByRole('searchbox', {
      name: 'Search for assets…',
    }),
  ).toBeVisible();
  await expect(folderList).toMatchAriaSnapshot(`
    - option "All Assets (6 assets)"
    - option "Global Assets (4 assets)"
    - separator
    - option "Projects (1 asset)"
    - option "Posts (1 asset)"
  `);

  await folderList.getByRole('option', { name: /Global Assets/ }).click();

  // The folder replaces the list
  const folder = page.getByRole('main', { name: /Global Assets.*Asset Folder/ });

  await expect(folder.getByRole('grid', { name: 'Assets' })).toMatchAriaSnapshot(`
    - row "forest.png"
    - row "guide.txt"
    - row "ocean.png"
    - row "sunset.png"
  `);
  await expect(folderList).toBeHidden();

  // A single tap opens an asset
  await folder.getByRole('row', { name: 'forest.png' }).tap();

  const assetEditor = page.getByRole('group', { name: 'Asset Editor' });

  await expect(assetEditor.getByRole('img', { name: 'forest.png' })).toBeVisible();
  await expect(assetEditor).toContainText('/static/uploads/forest.png');
  await expect(page).toHaveURL(/#\/assets\/static\/uploads\/forest\.png$/);

  await assetEditor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(assetEditor).toBeHidden();
  await expect(folder.getByRole('row', { name: 'forest.png' })).toBeVisible();

  // The back button leads to the folder list, where no folder is left selected, so the same one
  // can be opened again
  await folder.getByRole('button', { name: 'Back to Asset Folder List' }).click();
  await expect(folderList).toBeVisible();
  await expect(page).toHaveURL(/#\/assets$/);
  await expect(folderList.getByRole('option', { selected: true })).toHaveCount(0);
  await folderList.getByRole('option', { name: /Global Assets/ }).click();
  await expect(folder).toBeVisible();
});

test('moves between the assets with a swipe', async ({ page }) => {
  await page.getByRole('option', { name: /Global Assets/ }).click();
  await page.getByRole('row', { name: 'ocean.png' }).tap();

  const assetEditor = page.getByRole('group', { name: 'Asset Editor' });

  await expect(assetEditor.getByRole('img', { name: 'ocean.png' })).toBeVisible();

  // A swipe to the left shows the next asset, and one to the right the previous asset
  await swipe(page, assetEditor.getByRole('img', { name: 'ocean.png' }), -200);
  await expect(assetEditor.getByRole('img', { name: 'sunset.png' })).toBeVisible();
  await expect(page).toHaveURL(/#\/assets\/static\/uploads\/sunset\.png$/);
  await expect(assetEditor.getByRole('button', { name: 'Next Asset' })).toBeDisabled();

  await swipe(page, assetEditor.getByRole('img', { name: 'sunset.png' }), 200);
  await expect(assetEditor.getByRole('img', { name: 'ocean.png' })).toBeVisible();
  await expect(page).toHaveURL(/#\/assets\/static\/uploads\/ocean\.png$/);

  // A short move is not a swipe
  await swipe(page, assetEditor.getByRole('img', { name: 'ocean.png' }), -10);
  await expect(assetEditor.getByRole('img', { name: 'ocean.png' })).toBeVisible();

  // Going back returns to the folder, not through the assets swiped past
  await assetEditor.getByRole('button', { name: 'Cancel Editing' }).click();
  await expect(assetEditor).toBeHidden();
  await expect(page).toHaveURL(/#\/assets\/static\/uploads$/);
});

test('deletes an asset from the edit options menu', async ({ cms, page }) => {
  await page.getByRole('option', { name: /Global Assets/ }).click();
  await page.getByRole('row', { name: 'forest.png' }).tap();

  const assetEditor = page.getByRole('group', { name: 'Asset Editor' });
  const menu = page.getByRole('menu', { name: 'Edit Options' });

  // The actions shown as buttons on a larger screen move into the menu
  await cms.openPopup(assetEditor.getByRole('button', { name: 'Show Edit Options' }), menu);
  await expect(menu).toMatchAriaSnapshot(`
    - menuitem "Copy"
    - menuitem "Download"
    - menuitem "Delete Asset"
    - menuitem "Edit Asset" [disabled]
    - menuitem "Rename Asset"
    - menuitem "Replace Asset"
    - separator
    - menuitem "View on Live Site"
  `);
  await menu.getByRole('menuitem', { name: 'Delete Asset' }).click();

  const dialog = page.getByRole('alertdialog');

  await expect(dialog).toContainText('Are you sure you want to delete this asset?');
  await dialog.getByRole('button', { name: 'Delete' }).click();

  // The asset is gone, and so is its editor
  await expect(assetEditor).toBeHidden();
  await expect(page.getByRole('grid', { name: 'Assets' })).toMatchAriaSnapshot(`
    - row "guide.txt"
    - row "ocean.png"
    - row "sunset.png"
  `);
  expect(await cms.readRepoFile('static/uploads/forest.png')).toBeUndefined();
});
