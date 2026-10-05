import { beforeAll, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';

import { entryEditorSettings } from '$lib/services/contents/editor/settings';
import { env } from '$lib/services/user/env.svelte';
import { initTestConfig } from '$lib/test/config';
import { createMockDraft, renderWithDraft } from '$lib/test/draft';

import ValidationPanel from './validation-panel.svelte';

const fields = [
  { name: 'title', label: 'Title', widget: 'string', required: true },
  { name: 'body', widget: 'text', pattern: ['^.{10,}$', 'Too short'] },
  { name: 'note', widget: 'string', required: false },
];

// A rich text field whose components hold their own fields, and a list with a subfield, whose items
// are stored under `tags.0`, `tags.1`, etc. while the list itself is validated as `tags`
const noteFields = [
  { name: 'body', label: 'Body', widget: 'richtext' },
  { name: 'tags', label: 'Tags', widget: 'list', min: 3, field: { name: 'tag', widget: 'string' } },
];

const i18n = {
  i18nEnabled: true,
  allLocales: ['en', 'fr'],
  initialLocales: ['en', 'fr'],
  defaultLocale: 'en',
  structure: /** @type {const} */ ('multiple_folders'),
};

describe('ValidationPanel', () => {
  beforeAll(async () => {
    // The fields are looked up in the site configuration
    await initTestConfig({
      i18n: {
        structure: /** @type {const} */ ('multiple_folders'),
        locales: ['en', 'fr'],
        default_locale: 'en',
      },
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          folder: 'content/posts',
          i18n: true,
          // A collection with i18n enabled needs a localized field. The optional `note` field
          // leaves the validation results alone
          fields: fields.map((field) => (field.name === 'note' ? { ...field, i18n: true } : field)),
        },
        { name: 'pages', label: 'Pages', folder: 'content/pages', fields },
        { name: 'notes', label: 'Notes', folder: 'content/notes', fields: noteFields },
      ],
    });
  });

  test('validates the entry and lists the errors per locale', async () => {
    const draft = createMockDraft({
      fields,
      i18n,
      values: {
        // A value without a field, which can be left in a file by hand, is not validated
        en: { title: '', body: 'short', note: 'fine', stray: 'x' },
        fr: { title: 'Bonjour', body: 'assez long, oui', note: '' },
      },
    });

    await renderWithDraft(ValidationPanel, { draft });

    const panel = page.getByRole('group', { name: 'Validation' });

    await expect.element(panel.getByText('Validation results will be shown here.')).toBeVisible();

    await panel.getByRole('button', { name: 'Validate' }).click();

    const english = panel.getByRole('group').nth(0);
    const french = panel.getByRole('group').nth(1);

    await expect.element(english.getByRole('heading', { level: 4 })).toHaveTextContent('English');
    expect(
      english
        .getByRole('button')
        .elements()
        .map((el) => el.textContent?.replace(/\s+/g, ' ').trim()),
    ).toEqual(['Title error This field is required.', 'body error Too short']);
    await expect.element(french.getByText('No errors found.')).toBeInTheDocument();

    // Clicking an error highlights the field
    const postMessage = vi.spyOn(window, 'postMessage');

    await english.getByRole('button', { name: /Title/ }).click();
    expect(postMessage).toHaveBeenCalledWith(
      { type: 'highlight-editor-field', payload: { locale: 'en', keyPath: 'title' } },
      window.location.origin,
    );
  });

  test('hands the selected field over when asked to', async () => {
    const onSelectField = vi.fn();
    const postMessage = vi.spyOn(window, 'postMessage');

    await renderWithDraft(ValidationPanel, {
      draft: createMockDraft({
        collectionName: 'pages',
        fields,
        values: { _default: { title: '', body: 'long enough text' } },
      }),
      props: { onSelectField },
    });
    await page.getByRole('button', { name: 'Validate' }).click();
    await page.getByRole('button', { name: /Title/ }).click();

    expect(onSelectField).toHaveBeenCalledExactlyOnceWith({ locale: '_default', keyPath: 'title' });
    expect(postMessage).not.toHaveBeenCalled();
  });

  test('lists a list error and a rich text editor component field error', async () => {
    const draft = createMockDraft({
      collectionName: 'notes',
      fields: noteFields,
      values: { _default: { body: 'Some text', 'tags.0': 'a' } },
      draft: {
        extraValues: {
          // The Source field of the built-in Image component is required
          _default: { 'body:c40:__sc_component_name': 'image', 'body:c40:src': '' },
        },
      },
    });

    await renderWithDraft(ValidationPanel, { draft });

    const panel = page.getByRole('group', { name: 'Validation' });

    await panel.getByRole('button', { name: 'Validate' }).click();
    await expect.element(panel.getByRole('button', { name: /Source/ })).toBeVisible();

    const items = panel
      .getByRole('group')
      .getByRole('button')
      .elements()
      .map((el) => el.textContent?.replace(/\s+/g, ' ').trim());

    expect(items).toEqual([
      // The list itself is invalid, while its items are stored under `tags.0`, etc.
      'Tags error You must add at least 3 items.',
      // A field of the Image component, stored in `extraValues`
      'Source error This field is required.',
    ]);

    // Clicking an error highlights the field, whether it’s a list or a component field
    const postMessage = vi.spyOn(window, 'postMessage');

    await panel.getByRole('button', { name: /Tags/ }).click();
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'highlight-editor-field', payload: { locale: '_default', keyPath: 'tags' } },
      window.location.origin,
    );
    await panel.getByRole('button', { name: /Source/ }).click();
    expect(postMessage).toHaveBeenLastCalledWith(
      { type: 'highlight-editor-field', payload: { locale: '_default', keyPath: 'body:c40:src' } },
      window.location.origin,
    );
  });

  test('has nothing to validate without a draft', async () => {
    await renderWithDraft(ValidationPanel, { draft: /** @type {any} */ (null) });

    await expect.element(page.getByRole('button', { name: 'Validate' })).toBeDisabled();
    await expect.element(page.getByText('Validation results will be shown here.')).toBeVisible();
  });

  test('reports a valid entry', async () => {
    const draft = createMockDraft({
      collectionName: 'pages',
      fields,
      values: { _default: { title: 'Hello', body: 'long enough text' } },
    });

    await renderWithDraft(ValidationPanel, { draft });
    await page.getByRole('button', { name: 'Validate' }).click();

    await expect.element(page.getByText('No errors found.')).toBeInTheDocument();
    // A single locale has no heading
    expect(page.getByRole('heading', { level: 4 }).elements()).toHaveLength(0);
  });

  test('lists a slug error, which opens the Slug panel', async () => {
    env.isSmallScreen = false;

    const draft = createMockDraft({
      fields,
      values: { _default: { title: 'Hello', body: 'long enough, yes', note: '' } },
      draft: { slugEditor: { _default: true }, currentSlugs: { _default: '' } },
    });

    // The slug is only given with the slug editor, so it’s required
    /** @type {any} */ (draft.collection).slug = { editable: true };

    await renderWithDraft(ValidationPanel, { draft });

    const panel = page.getByRole('group', { name: 'Validation' });

    await panel.getByRole('button', { name: 'Validate' }).click();

    const slugButton = panel.getByRole('button', { name: /Slug/ });

    await expect.element(slugButton).toMatchTextContent(/Slug.*The slug cannot be empty\./);
    await slugButton.click();
    expect(entryEditorSettings.current?.sidebarPanel).toBe('slug');
  });

  test('lists a parent folder error in the default locale only', async () => {
    const onSelectField = vi.fn();

    const draft = createMockDraft({
      fields,
      i18n,
      values: {
        en: { title: 'Hello', body: 'long enough, yes', note: '' },
        fr: { title: 'Bonjour', body: 'assez long, oui', note: '' },
      },
      // A relative segment would let the entry escape the collection folder
      draft: { currentPath: '../x' },
    });

    // The folder is only validated in a nested collection with the path editor
    Object.assign(/** @type {any} */ (draft.collection), {
      nested: { depth: 3 },
      meta: { path: { widget: 'string' } },
    });

    await renderWithDraft(ValidationPanel, { draft, props: { onSelectField } });

    const panel = page.getByRole('group', { name: 'Validation' });

    await panel.getByRole('button', { name: 'Validate' }).click();

    const english = panel.getByRole('group').nth(0);
    const french = panel.getByRole('group').nth(1);
    const pathButton = english.getByRole('button', { name: /Parent Folder/ });

    await expect
      .element(pathButton)
      .toMatchTextContent(
        /Parent Folder.*The path cannot contain relative segments such as “\.\.”\./,
      );
    // The folder is chosen for the whole entry in the default locale’s pane
    await expect.element(french.getByText('No errors found.')).toBeInTheDocument();
    expect(french.getByRole('button').elements()).toHaveLength(0);

    await pathButton.click();
    expect(onSelectField).toHaveBeenCalledExactlyOnceWith({ locale: 'en', keyPath: '_path' });
  });

  test('reports no errors once the invalid field is gone', async () => {
    const draft = createMockDraft({
      collectionName: 'pages',
      fields,
      values: { _default: { title: '', body: 'long enough text' } },
    });

    await renderWithDraft(ValidationPanel, { draft });
    await page.getByRole('button', { name: 'Validate' }).click();
    await expect.element(page.getByRole('button', { name: /Title/ })).toBeVisible();

    // The messages are kept until the next validation, but the field isn’t listed any more
    delete draft.currentValues._default.title;

    await expect.element(page.getByText('No errors found.')).toBeInTheDocument();
    expect(page.getByRole('button', { name: /Title/ }).elements()).toHaveLength(0);
  });
});
