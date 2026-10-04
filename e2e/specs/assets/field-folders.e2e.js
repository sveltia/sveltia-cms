import { createPNG } from '../../fixtures/files.js';
import { expect, test } from '../../fixtures/test.js';

/**
 * An Astro-like site whose blog collection keeps its images in one folder and the author photos,
 * picked with a field of their own, in another, both referred to with a path relative to the entry.
 */
const CONFIG = {
  backend: { name: 'test-repo' },
  media_folder: 'public/images',
  public_folder: '/images',
  collections: [
    {
      name: 'blog',
      label: 'Blog',
      folder: 'src/content/blog',
      media_folder: '/src/assets/images/blog',
      public_folder: '../../assets/images/blog',
      fields: [
        { name: 'title', label: 'Title' },
        {
          name: 'author_photo',
          label: 'Author Photo',
          widget: 'image',
          media_folder: '/src/assets/authors',
          public_folder: '../../assets/authors',
        },
      ],
    },
  ],
};

test.use({ config: CONFIG });

test('shows an image in an absolute field-level media folder referred to by a relative path', async ({
  cms,
  page,
}) => {
  await cms.open();
  await cms.seed({
    'src/assets/authors/jane.png': createPNG({ color: [200, 100, 50] }),
    'src/content/blog/hello.md':
      '---\ntitle: Hello\nauthor_photo: ../../assets/authors/jane.png\n---\n',
  });
  await cms.signIn();
  await page.getByRole('row', { name: 'Hello' }).click();

  const field = page
    .getByRole('group', { name: 'Content Editor' })
    .getByRole('group', { name: '“\u2068Author Photo\u2069” Field' });

  // The thumbnail is decorative, with an empty `alt`, so it has no role
  const thumbnail = field.locator('img');

  await expect(thumbnail).toBeVisible();
  // The image is found and decoded, not a broken one
  await expect.poll(() => thumbnail.evaluate((img) => img.naturalWidth)).toBeGreaterThan(0);
});
