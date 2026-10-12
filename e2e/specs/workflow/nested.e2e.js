import { NESTED_CONFIG } from '../../fixtures/configs/nested.js';
import { WORKFLOW_CONFIG } from '../../fixtures/configs/workflow.js';
import { expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

/**
 * @import { Page } from '@playwright/test';
 */

/**
 * Pages in a nested collection, each in a folder of its own, saved with Editorial Workflow.
 */
test.use({
  config: {
    ...WORKFLOW_CONFIG,
    media_folder: NESTED_CONFIG.media_folder,
    public_folder: NESTED_CONFIG.public_folder,
    collections: [NESTED_CONFIG.collections[0]],
  },
});

test.beforeEach(async ({ github }) => {
  github.commit({
    'content/pages/index.md': '---\ntitle: Home\n---\n',
    'content/pages/about/index.md': '---\ntitle: About Us\n---\n',
    // A page holding another page is shown as a folder in the sidebar
    'content/pages/about/history/index.md': '---\ntitle: History\n---\n',
  });
});

/**
 * Create a page titled “Team” in the folder being browsed, and save it to a pull request.
 * @param {Page} page Page.
 */
const createTeamPage = async (page) => {
  const editor = getEditor(page);

  await page.getByRole('button', { name: 'Create New Entry' }).click();
  await editor.getByRole('textbox', { name: 'Title' }).fill('Team');
  await editor.getByRole('button', { name: 'Save' }).click();
  await page
    .getByRole('alertdialog', { name: 'Send for Review' })
    .getByRole('button', { name: 'Later' })
    .click();
};

test('names the branch of a new page after its path, not its slug alone', async ({
  cms,
  github,
  page,
}) => {
  await cms.open();

  // A page at the top of the collection takes the `team` branch
  await createTeamPage(page);
  await expect.poll(() => github.pullRequests.length).toBe(1);

  // A page of the same name in a folder has a branch of its own, rather than colliding with it
  await page.getByRole('tree', { name: 'Collection List' }).getByText('About Us').click();
  await createTeamPage(page);
  await expect.poll(() => github.pullRequests.length).toBe(2);

  // The branch is named after the path within the collection folder, the way an existing page’s is
  expect(github.pullRequests.map(({ head }) => head)).toEqual([
    'cms/pages/team%2Findex',
    'cms/pages/about%2Fteam%2Findex',
  ]);
  expect(github.readFile('content/pages/team/index.md', 'cms/pages/team%2Findex')).toContain(
    'title: Team',
  );
  expect(
    github.readFile('content/pages/about/team/index.md', 'cms/pages/about%2Fteam%2Findex'),
  ).toContain('title: Team');
});
