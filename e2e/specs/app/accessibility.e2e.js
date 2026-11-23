import AxeBuilder from '@axe-core/playwright';

import { MONOLINGUAL_CONFIG, MONOLINGUAL_FILES } from '../../fixtures/configs/monolingual.js';
import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';
import { openCollection, openEntry } from '../../fixtures/ui.js';
import { getBottomNavigation, PHONE, signIn } from '../mobile/helpers.js';

/**
 * @import { Page } from '@playwright/test';
 * @import { CMS } from '../../fixtures/test.js';
 */

/**
 * The WCAG 2.2 Level A and AA rules, which `ACCESSIBILITY.md` names as the target.
 */
const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'];
/**
 * Rules left out of every scan on purpose. `meta-viewport`: the viewport tag disables the browser’s
 * pinch-zoom, which is reserved for a pinch-zoom feature in the app itself.
 */
const DISABLED_RULES = ['meta-viewport'];
const FILES = { ...MONOLINGUAL_FILES, 'static/uploads/photo.png': createPNG() };

test.use({ config: MONOLINGUAL_CONFIG });

/**
 * Check the page for violations of the WCAG rules with axe.
 * @param {Page} page Page.
 */
const expectNoViolations = async (page) => {
  // The app shell is `position: fixed`, which leaves the `body` with no height. Its `overflow:
  // hidden` applies to the viewport, but axe takes it for a box that clips the page, considers the
  // page hidden and skips the checks that need a visible element, such as color contrast
  await page.addStyleTag({ content: 'body { min-height: 100vh; }' });

  // Contrast measured during a transition is that of the colors halfway through it
  await page.evaluate(() =>
    Promise.allSettled(
      document
        .getAnimations()
        .filter(
          (animation) =>
            animation.playState === 'running' &&
            animation.effect?.getComputedTiming().iterations !== Infinity,
        )
        .map((animation) => animation.finished),
    ),
  );

  const { violations } = await new AxeBuilder({ page })
    .withTags(WCAG_TAGS)
    .disableRules(DISABLED_RULES)
    .analyze();

  expect(
    violations.flatMap(({ id, nodes }) =>
      nodes.map(({ target, failureSummary }) => ({ id, target, failureSummary })),
    ),
  ).toEqual([]);
};

/**
 * Choose an item in the account menu and wait for the dialog it opens.
 * @param {CMS} cms CMS.
 * @param {Page} page Page.
 * @param {string} name Name of the item and the dialog.
 */
const openAccountDialog = async (cms, page, name) => {
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Show Account Menu' }),
    page.getByRole('menuitem', { name }),
  );
  await expect(page.getByRole('dialog', { name })).toBeVisible();
};

['light', 'dark'].forEach((colorScheme) => {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme: /** @type {'light' | 'dark'} */ (colorScheme) });

    test.beforeEach(async ({ cms, page }) => {
      await cms.open();
      await expect(page.locator('html')).toHaveAttribute('data-theme', colorScheme);
    });

    test('has no violations on the sign-in page', async ({ page }) => {
      await expect(page.getByRole('button', { name: 'Work with Test Repository' })).toBeVisible();
      await expectNoViolations(page);
    });

    test.describe('signed in', () => {
      test.beforeEach(async ({ cms }) => {
        await cms.seed(FILES);
        await cms.signIn();
      });

      test('has no violations in the entry list', async ({ page }) => {
        await openCollection(page, 'Posts');
        await expect(page.getByRole('row', { name: /^First Light/ })).toBeVisible();
        await expectNoViolations(page);
      });

      test('has no violations in the entry editor', async ({ page }) => {
        await openEntry(page, 'First Light', { collection: 'Posts' });
        await expectNoViolations(page);
      });

      test('has no violations in the asset library', async ({ page }) => {
        await page.getByRole('radio', { name: 'Assets' }).click();
        await expect(
          page.getByRole('grid', { name: 'Assets' }).getByRole('row', { name: 'photo.png' }),
        ).toBeVisible();
        await expectNoViolations(page);
      });

      test('has no violations in the search results', async ({ page }) => {
        await page.getByRole('searchbox', { name: 'Search for contents…' }).fill('First');
        await expect(
          page.getByRole('main').getByRole('grid', { name: 'Entries' }).getByRole('row'),
        ).toHaveText([/Posts.*First Light/]);
        await expectNoViolations(page);
      });

      test('has no violations in the Settings dialog', async ({ cms, page }) => {
        await openAccountDialog(cms, page, 'Settings');
        await expectNoViolations(page);
      });

      test('has no violations in the Keyboard Shortcuts dialog', async ({ cms, page }) => {
        await openAccountDialog(cms, page, 'Keyboard Shortcuts');
        await expectNoViolations(page);
      });
    });
  });
});

test.describe('small screen', () => {
  test.use(PHONE);

  /**
   * Open the Asset Library from the bottom navigation.
   * @param {Page} page Page.
   */
  const openAssets = async (page) => {
    await getBottomNavigation(page).getByRole('radio', { name: 'Assets' }).click();
  };

  test.beforeEach(async ({ cms, page }) => {
    await cms.open();
    await cms.seed(FILES);
    await signIn(page);
  });

  test('has no violations in the collection list', async ({ page }) => {
    await expect(getBottomNavigation(page)).toBeVisible();
    await expectNoViolations(page);
  });

  test('has no violations in the entry list', async ({ page }) => {
    await openCollection(page, 'Posts');
    await expect(page.getByRole('grid', { name: 'Entries' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('has no violations in the entry editor', async ({ page }) => {
    await openEntry(page, 'First Light', { collection: 'Posts' });
    await expectNoViolations(page);
  });

  test('has no violations in the asset folder list', async ({ page }) => {
    await openAssets(page);
    await expect(page.getByRole('listbox', { name: 'Asset Folder List' })).toBeVisible();
    await expectNoViolations(page);
  });

  test('has no violations in the asset list', async ({ page }) => {
    await openAssets(page);
    // Not `openFolder()`: on a small screen, the folder list goes away once a folder is opened
    await page
      .getByRole('listbox', { name: 'Asset Folder List' })
      .getByRole('option', { name: /All Assets/ })
      .click();
    await expect(page.getByRole('grid', { name: 'Assets' })).toBeVisible();
    await expectNoViolations(page);
  });
});

test('has no violations with an empty collection', async ({ cms, page }) => {
  await cms.start(
    Object.fromEntries(
      Object.entries(FILES).filter(([path]) => !path.startsWith('content/authors/')),
    ),
  );
  await openCollection(page, 'Posts');
  await expect(
    page.getByRole('tree', { name: 'Collection List' }).getByRole('treeitem', { name: /^Authors/ }),
  ).toBeVisible();
  await expectNoViolations(page);
});
