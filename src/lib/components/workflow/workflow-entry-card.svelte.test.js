import { beforeEach, describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { deployments } from '$lib/services/deployments';
import { forkedRepository } from '$lib/services/workflow/open-authoring';
import { createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import WorkflowEntryCard from './workflow-entry-card.svelte';

const fields = [{ name: 'title', widget: 'string' }];

/**
 * Build an unpublished entry.
 * @param {Record<string, any>} [workflow] Workflow properties to override.
 * @param {Record<string, any>} [entry] Entry properties to override.
 * @returns {any} Entry.
 */
const createEntry = (workflow = {}, entry = {}) => ({
  ...createMockEntry({ slug: 'hello', content: { _default: { title: 'Hello' } } }),
  ...entry,
  workflow: {
    status: 'draft',
    collectionName: 'posts',
    pullRequest: {
      number: 1,
      branch: 'cms/posts/hello',
      headSHA: 'abc',
      author: { name: 'Melvin' },
      updatedDate: new Date('2024-01-15T10:00:00Z'),
    },
    ...workflow,
  },
});

describe('WorkflowEntryCard', () => {
  beforeEach(async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [
        {
          name: 'posts',
          label: 'Posts',
          label_singular: 'Post',
          folder: 'content/posts',
          preview_path: 'posts/{{slug}}',
          fields,
        },
        {
          name: 'pages',
          label: 'Pages',
          files: [{ name: 'about', label: 'About Us', file: 'content/about.md', fields }],
        },
        { name: 'locked', label: 'Locked', folder: 'content/locked', delete: false, fields },
      ],
    });
    setEntries([]);
    deployments.current = {};
    forkedRepository.current = undefined;
    window.location.hash = '#/workflow';
  });

  test('shows the entry with its author, date and build state', async () => {
    const onDelete = vi.fn();

    deployments.current = { abc: { state: 'pending', checkedTime: 0 } };

    const { container } = await render(WorkflowEntryCard, { entry: createEntry(), onDelete });
    const card = page.getByRole('listitem');

    expect(container.querySelector('.collection')).toHaveTextContent('Post');
    expect(container.querySelector('.author')).toHaveTextContent('Melvin');
    expect(container.querySelector('.date')).toHaveTextContent('Jan 15');
    expect(container.querySelector('.deploy-status-badge')).toHaveTextContent('Building…');
    await expect.element(card).toHaveAttribute('draggable', 'true');

    // The draft isn’t published, so the preview waits for the build
    await expect.element(card.getByRole('button', { name: 'Checking for Preview' })).toBeDisabled();
    // A draft has no publish button
    expect(card.getByRole('button', { name: 'Publish Entry' }).elements()).toHaveLength(0);

    await card.getByRole('button', { name: 'Delete Entry' }).click();
    expect(onDelete).toHaveBeenCalledOnce();

    await card.getByRole('button', { name: 'Hello' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/posts/entries/hello');
  });

  test('offers to publish an entry that is ready', async () => {
    const onPublish = vi.fn();

    await render(WorkflowEntryCard, {
      entry: createEntry({ status: 'pending_publish' }),
      onPublish,
    });

    await page.getByRole('button', { name: 'Publish Entry' }).click();
    expect(onPublish).toHaveBeenCalledOnce();
  });

  test('offers to discard the changes to a published entry', async () => {
    setEntries([createMockEntry({ slug: 'hello' })]);

    await render(WorkflowEntryCard, { entry: createEntry() });
    await expect.element(page.getByRole('button', { name: 'Discard Changes' })).toBeInTheDocument();
  });

  test('presents a pending deletion with its own actions', async () => {
    const onDelete = vi.fn();
    const onPublish = vi.fn();

    await render(WorkflowEntryCard, {
      entry: createEntry({ status: 'pending_deletion' }),
      onDelete,
      onPublish,
    });

    const card = page.getByRole('listitem');

    await expect.element(card).toHaveAttribute('draggable', 'false');

    await card.getByRole('button', { name: 'Cancel Deletion' }).click();
    expect(onDelete).toHaveBeenCalledOnce();

    await card.getByRole('button', { name: 'Delete Entry' }).click();
    expect(onPublish).toHaveBeenCalledOnce();
  });

  test('links a collection file by its name', async () => {
    const { container } = await render(WorkflowEntryCard, {
      entry: createEntry(
        { collectionName: 'pages', fileName: 'about' },
        { ...createMockEntry({ slug: 'about', folder: 'content' }), id: 'content/about' },
      ),
    });

    expect(container.querySelector('.collection')).toHaveTextContent('Pages');
    expect(container.querySelector('.title')).toHaveTextContent('About Us');
    // A collection file always has a published version to fall back to
    await expect.element(page.getByRole('button', { name: 'Discard Changes' })).toBeInTheDocument();

    await page.getByRole('button', { name: 'About Us' }).click();
    await expect.poll(() => window.location.hash).toBe('#/collections/pages/entries/about');
  });

  test('shows the thumbnail, or falls back to the slug without a collection', async () => {
    await initTestConfig({
      site_url: 'https://example.com',
      collections: [
        {
          name: 'photos',
          label: 'Photos',
          folder: 'content/photos',
          thumbnail: 'image',
          fields: [...fields, { name: 'image', widget: 'image' }],
        },
      ],
    });

    const { container } = await render(WorkflowEntryCard, {
      entry: createEntry(
        {
          collectionName: 'photos',
          pullRequest: {
            number: 2,
            branch: 'cms/photos/hello',
            author: { name: 'Melvin' },
            updatedDate: new Date('2024-01-15T10:00:00Z'),
          },
        },
        createMockEntry({
          slug: 'hello',
          folder: 'content/photos',
          content: { _default: { title: 'Hello', image: 'https://example.com/hello.png' } },
        }),
      ),
    });

    await expect
      .poll(() => container.querySelector('img')?.getAttribute('src'))
      .toBe('https://example.com/hello.png');

    // A draft in a collection that no longer exists is identified by its slug
    const { container: other } = await render(WorkflowEntryCard, {
      entry: createEntry({ collectionName: 'gone' }),
    });

    expect(other.querySelector('.title')).toHaveTextContent('hello');
  });

  test('hides the actions that aren’t allowed', async () => {
    await render(WorkflowEntryCard, {
      entry: createEntry(
        { collectionName: 'locked', status: 'pending_publish' },
        createMockEntry({ slug: 'hello', folder: 'content/locked' }),
      ),
    });

    expect(page.getByRole('button', { name: 'Delete Entry' }).elements()).toHaveLength(0);
    await expect.element(page.getByRole('button', { name: 'Publish Entry' })).toBeInTheDocument();

    // An Open Authoring contributor can’t publish
    forkedRepository.current = /** @type {any} */ ({ owner: 'me', repo: 'site' });
    await expect
      .poll(() => page.getByRole('button', { name: 'Publish Entry' }).elements().length)
      .toBe(0);
  });

  test('is disabled while busy, and marked while dragged', async () => {
    const { container } = await render(WorkflowEntryCard, {
      entry: createEntry({ status: 'pending_publish' }),
      busy: true,
      dragging: true,
    });

    await expect.element(page.getByRole('button', { name: 'Delete Entry' })).toBeDisabled();
    await expect.element(page.getByRole('button', { name: 'Publish Entry' })).toBeDisabled();
    expect(container.querySelector('.card')).toHaveClass('dragging');
    expect(container.querySelector('.card')).toHaveAttribute('draggable', 'false');
  });
});
