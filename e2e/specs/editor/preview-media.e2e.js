import { createPNG } from '../../fixtures/files.js';
import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

const EXTERNAL_URL = 'https://media.example.com/external.png';

test.use({
  // Make the browser pick the `2x` candidate of a `srcset`
  deviceScaleFactor: 2,
  config: {
    ...BASE_CONFIG,
    collections: [
      {
        name: 'posts',
        label: 'Posts',
        folder: 'content/posts',
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'body', label: 'Body', widget: 'richtext' },
        ],
      },
    ],
  },
});

test('resolves the media in the rich text preview without requesting their public paths', async ({
  cms,
  page,
}) => {
  /** @type {string[]} */
  const requests = [];

  page.on('request', (request) => {
    requests.push(request.url());
  });

  // An external image still loads from its own URL
  await page.route(EXTERNAL_URL, (route) =>
    route.fulfill({ contentType: 'image/png', body: createPNG({ color: [0, 0, 255] }) }),
  );

  await cms.open();
  await cms.seed({
    'static/images/canoe.png': createPNG({ color: [0, 128, 0] }),
    'static/images/canoe-2x.png': createPNG({ size: 64, color: [0, 128, 0] }),
    'static/images/poster.png': createPNG({ color: [128, 0, 0] }),
    'content/posts/canoe.md': [
      '---',
      'title: Canoe trip',
      '---',
      '',
      '![Canoe](/images/canoe.png)',
      '',
      '<img src="/images/canoe.png" srcset="/images/canoe-2x.png 2x" alt="Canoe in 2x">',
      '',
      '<video poster="/images/poster.png"></video>',
      '',
      `![External](${EXTERNAL_URL})`,
      '',
    ].join('\n'),
  });
  await cms.signIn();
  await page.getByRole('row', { name: /Canoe trip/ }).click();

  const preview = getEditor(page).getByRole('document', { name: 'Content Preview' });
  const canoe = preview.getByRole('img', { name: 'Canoe', exact: true });
  const canoe2x = preview.getByRole('img', { name: 'Canoe in 2x' });
  const external = preview.getByRole('img', { name: 'External' });

  await expect(canoe).toHaveAttribute('src', /^blob:/);
  await expect(canoe2x).toHaveAttribute('src', /^blob:/);
  await expect(canoe2x).toHaveAttribute('srcset', /^blob:\S+ 2x$/);
  await expect(preview.locator('video')).toHaveAttribute('poster', /^blob:/);
  await expect(external).toHaveAttribute('src', EXTERNAL_URL);

  // The images are displayed
  await Promise.all(
    [canoe, external].map((img) =>
      expect.poll(() => img.evaluate((el) => /** @type {any} */ (el).naturalWidth)).toBe(32),
    ),
  );

  expect(requests).toContain(EXTERNAL_URL);
  expect(requests.filter((url) => new URL(url).pathname.startsWith('/images/'))).toEqual([]);
});
