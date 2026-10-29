import { expect, GITHUB_CONFIG, test } from '../../fixtures/test.js';
import { getEntryList } from '../../fixtures/ui.js';

// A colleague’s commit fetched while the user is reordering the entries reloads them, which the
// mock GitHub API can simulate
test.use({
  config: {
    ...GITHUB_CONFIG,
    collections: [
      {
        ...GITHUB_CONFIG.collections[0],
        reorder: true,
        view_groups: [{ label: 'Kind', field: 'kind' }],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'kind', label: 'Kind' },
        ],
      },
      // A second collection, so the sidebar lists the collections with their entry counts
      { name: 'pages', label: 'Pages', folder: 'content/pages', fields: [{ name: 'title' }] },
    ],
  },
});

/**
 * Get a post file.
 * @param {string} title Title.
 * @param {string} kind Kind.
 * @param {number} order Order.
 * @returns {string} File content.
 */
const post = (title, kind, order) => `---\norder: ${order}\ntitle: ${title}\nkind: ${kind}\n---\n`;

test.beforeEach(async ({ github }) => {
  github.commit({
    'content/posts/alpha.md': post('Alpha', 'news', 1),
    'content/posts/bravo.md': post('Bravo', 'tips', 2),
    'content/posts/charlie.md': post('Charlie', 'news', 3),
  });
});

test('keeps the entries as they are being reordered, then restores the grouping', async ({
  cms,
  github,
  page,
}) => {
  // The CMS checks the repository for changes every minute
  await page.clock.install();
  await cms.open();
  await cms.chooseMenuItem(
    page.getByRole('button', { name: 'Group', exact: true }),
    page.getByRole('menuitemradio', { name: 'Kind' }),
  );

  const grouped = `
    - rowgroup "news":
      - row /Alpha/
      - row /Charlie/
    - rowgroup "tips":
      - row /Bravo/
  `;

  await expect(getEntryList(page)).toMatchAriaSnapshot(grouped);
  // Reordering lists all the entries together, as the order is the same for all of them
  await page.getByRole('button', { name: 'Reorder Entries' }).click();
  await page
    .getByRole('row', { name: /Charlie/ })
    .getByRole('button', { name: 'Move Up' })
    .click();

  const reordered = `
    - rowgroup:
      - row /Alpha/
      - row /Charlie/
      - row /Bravo/
  `;

  await expect(getEntryList(page)).toMatchAriaSnapshot(reordered);

  // A colleague’s commit is fetched, which reloads the entries, but mustn’t restore the grouping
  // the user had before reordering. The other collection’s entry count tells it has been fetched
  github.commit({ 'content/pages/about.md': '---\ntitle: About\n---\n' });
  await page.clock.fastForward('01:01');
  await expect(
    page.getByRole('tree', { name: 'Collection List' }).getByRole('treeitem', { name: 'Pages' }),
  ).toContainText('Pages 1');
  await expect(getEntryList(page)).toMatchAriaSnapshot(reordered);
  await expect(getEntryList(page).getByRole('rowgroup', { name: 'news' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Done Reordering Entries' }).click();
  await expect(page.getByRole('button', { name: 'Reorder Entries' })).toBeVisible();
  await expect
    .poll(() => github.readFile('content/posts/charlie.md'))
    .toBe(post('Charlie', 'news', 2));
  expect(github.readFile('content/posts/bravo.md')).toBe(post('Bravo', 'tips', 3));
  // Exiting the mode restores the grouping
  await expect(getEntryList(page)).toMatchAriaSnapshot(grouped);
});
