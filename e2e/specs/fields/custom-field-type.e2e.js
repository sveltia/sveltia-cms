import { BASE_CONFIG, expect, test } from '../../fixtures/test.js';

test.use({
  config: {
    ...BASE_CONFIG,
    collections: [
      {
        ...BASE_CONFIG.collections[0],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'count', label: 'Count', widget: 'counter' },
        ],
      },
    ],
  },
});

/**
 * Script registering a custom field type written with hooks from `CMS.React`, the way an admin
 * page would after the CMS `<script>`. Its `isValid` method, exposed with the `useImperativeHandle`
 * hook, rejects a count above 2.
 */
const REGISTRATION_SCRIPT = `
  const { useImperativeHandle, useState } = CMS.React;

  const CounterControl = ({ value, onChange, ref }) => {
    const [count, setCount] = useState(Number(value) || 0);

    useImperativeHandle(ref, () => ({
      isValid: () => count <= 2 || { error: { message: 'Count must be 2 or less' } },
    }));

    return h('button', {
      type: 'button',
      onClick: () => {
        setCount(count + 1);
        onChange(count + 1);
      },
    }, 'Count: ' + count);
  };

  CMS.registerFieldType('counter', CounterControl);
`;

test.beforeEach(async ({ cms, page }) => {
  await page.route('**/admin/', async (route) => {
    const response = await route.fetch();
    const html = await response.text();

    await route.fulfill({
      response,
      body: html.replace('</body>', `<script>${REGISTRATION_SCRIPT}</script></body>`),
    });
  });

  await cms.open();
  await cms.signIn();
});

test('renders a custom field control using hooks from the React the CMS exposes', async ({
  cms,
  page,
}) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const counter = editor.getByRole('button', { name: /^Count: / });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Counted');
  await expect(counter).toHaveText('Count: 0');
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText('Count: 2');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/counted.md'])
    .toBe('---\ntitle: Counted\ncount: 2\n---\n');
});

test('validates a custom field with an `isValid` method exposed by a function control', async ({
  cms,
  page,
}) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = page.getByRole('group', { name: 'Content Editor' });
  const counter = editor.getByRole('button', { name: /^Count: / });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Counted');
  await counter.click();
  await counter.click();
  await counter.click();
  await expect(counter).toHaveText('Count: 3');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect(editor.getByText('Count must be 2 or less')).toBeVisible();
  expect((await cms.readRepo())['content/posts/counted.md']).toBeUndefined();
});
