import { expect, test } from '../fixtures/test.js';

test('skips an entry file too large to read rather than loading it as an empty entry', async ({
  cms,
  page,
}) => {
  const hugeFile = `---\ntitle: Huge Post\n---\n\n${'a'.repeat(10 * 1024 * 1024)}\n`;

  await cms.open();
  await cms.seed({
    'content/posts/first-post.md': '---\ntitle: First Post\n---\n\nHello, world!\n',
    'content/posts/huge-post.md': hugeFile,
  });
  await cms.signIn();

  await expect(page.getByRole('alert')).toContainText(
    'There was an error while parsing an entry file. Check the browser console for details.',
  );

  const list = page.getByRole('group', { name: 'Entry List' });

  await expect(list.getByRole('row', { name: /First Post/ })).toBeVisible();
  // An empty entry would wipe the file when saved
  await expect(list.getByRole('row')).toHaveCount(1);
});
