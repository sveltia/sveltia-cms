import { addScripts, BASE_CONFIG, expect, test } from '../../fixtures/test.js';
import { getEditor } from '../../fixtures/ui.js';

test.use({
  config: {
    ...BASE_CONFIG,
    collections: [
      {
        ...BASE_CONFIG.collections[0],
        fields: [
          { name: 'title', label: 'Title' },
          { name: 'tags', label: 'Tags', widget: 'tags', required: false },
        ],
      },
    ],
  },
});

/**
 * Script registering a custom field type storing a list value, which the control can clear with
 * `null`. The control shows the value it’s given.
 */
const REGISTRATION_SCRIPT = `
  const TagsControl = ({ value, onChange }) => {
    const tags = Array.isArray(value) ? value : [];

    return h('div', {},
      h('output', { 'aria-label': 'Chosen tags' }, tags.length ? tags.join(', ') : 'None'),
      h('button', { type: 'button', onClick: () => onChange(['lake', 'pond']) }, 'Set Tags'),
      h('button', { type: 'button', onClick: () => onChange(null) }, 'Clear Tags'),
    );
  };

  CMS.registerFieldType('tags', TagsControl);
`;

test.beforeEach(async ({ cms, page }) => {
  await addScripts(page, { after: REGISTRATION_SCRIPT });

  await cms.open();
  await cms.signIn();
});

test('clears a list value, leaving none of its items behind', async ({ cms, page }) => {
  await page.getByRole('button', { name: 'Create New Entry' }).first().click();

  const editor = getEditor(page);
  const tags = editor.getByRole('status', { name: 'Chosen tags' });

  await editor.getByRole('textbox', { name: 'Title' }).fill('Tagged');
  await expect(tags).toHaveText('None');
  await editor.getByRole('button', { name: 'Set Tags' }).click();
  await expect(tags).toHaveText('lake, pond');
  await editor.getByRole('button', { name: 'Clear Tags' }).click();
  // The control is given the cleared value rather than the items it had before
  await expect(tags).toHaveText('None');
  await editor.getByRole('button', { name: 'Save' }).click();

  await expect
    .poll(async () => (await cms.readRepo())['content/posts/tagged.md'])
    .toBe('---\ntitle: Tagged\ntags: null\n---\n');
});
