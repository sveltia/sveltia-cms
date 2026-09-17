import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { render } from 'vitest-browser-svelte';

import { planAssetDeletion } from '$lib/services/assets/data/cascade';
import { createMockAsset, createMockEntry, initTestConfig, setEntries } from '$lib/test/config';

import DeleteAssetsButton from './delete-assets-button.svelte';

const assets = [createMockAsset({ name: 'a.png' }), createMockAsset({ name: 'b.png' })];

/**
 * Build a blocker for a post’s required Image field.
 * @returns {any} Blocker.
 */
const createBlocker = () => ({
  collectionName: 'posts',
  collectionLabel: 'Posts',
  fieldLabel: 'Cover',
  entry: { id: 'post-1', slug: 'post-1', locales: {} },
  summary: 'Post 1',
  locale: '_default',
  keyPath: 'cover',
  messages: ['This field is required.'],
});

describe('DeleteAssetsButton', () => {
  test('asks for confirmation, then deletes the assets', async () => {
    const deleteAssets = vi.fn().mockResolvedValue(undefined);
    const onDelete = vi.fn();

    await render(DeleteAssetsButton, {
      assets,
      deleteAssets,
      onDelete,
      buttonDescription: 'Delete Selected Assets',
      dialogDescription: 'Are you sure?',
    });

    await page.getByRole('button', { name: 'Delete Selected Assets' }).click();

    const dialog = page.getByRole('alertdialog', { name: 'Delete Assets' });

    await expect.element(dialog).toHaveTextContent('Delete Assets Are you sure? Delete Cancel');
    await dialog.getByRole('button', { name: 'Delete' }).click();

    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith(assets));
    await vi.waitFor(() => expect(onDelete).toHaveBeenCalledOnce());
  });

  test('skips the callback when the deletion is refused', async () => {
    const deleteAssets = vi.fn().mockResolvedValue(false);
    const onDelete = vi.fn();

    await render(DeleteAssetsButton, { assets: [assets[0]], deleteAssets, onDelete });

    await page.getByRole('button', { name: 'Delete' }).click();
    await page
      .getByRole('alertdialog', { name: 'Delete Asset' })
      .getByRole('button', { name: 'Delete' })
      .click();

    await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledOnce());
    expect(onDelete).not.toHaveBeenCalled();
  });

  test('is disabled without assets, and can be a menu item', async () => {
    await render(DeleteAssetsButton, { deleteAssets: vi.fn() });
    await expect.element(page.getByRole('button')).toHaveAttribute('aria-disabled', 'true');

    await render(DeleteAssetsButton, { assets, deleteAssets: vi.fn(), useButton: false });
    await expect.element(page.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
  });

  describe('with entries using the assets', () => {
    test('waits for the plan, then notes the entries whose references are removed', async () => {
      const { promise, resolve } = /** @type {PromiseWithResolvers<any>} */ (
        Promise.withResolvers()
      );

      const deleteAssets = vi.fn().mockResolvedValue(undefined);
      const planDeletion = vi.fn().mockReturnValue(promise);

      await render(DeleteAssetsButton, {
        assets: [assets[0]],
        deleteAssets,
        planDeletion,
        dialogDescription: 'Are you sure?',
      });

      await page.getByRole('button', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Asset' });

      // Deleting has to wait for the plan, which decides whether it can go ahead
      await expect.element(dialog).toHaveTextContent('Delete Asset Are you sure? Delete Cancel');
      await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
      expect(planDeletion).toHaveBeenCalledWith([assets[0]]);

      resolve({
        targets: [{ entry: { id: 'post-1' }, collection: { name: 'posts' } }],
        blockers: [],
      });

      await expect
        .element(dialog)
        .toHaveTextContent(
          'Delete Asset Are you sure? The reference to it in an entry will be removed as well. ' +
            'Delete Cancel',
        );
      await dialog.getByRole('button', { name: 'Delete' }).click();

      await vi.waitFor(() => expect(deleteAssets).toHaveBeenCalledWith([assets[0]]));
    });

    test('refuses the deletion when a field would be left invalid', async () => {
      const deleteAssets = vi.fn();

      await render(DeleteAssetsButton, {
        assets,
        deleteAssets,
        planDeletion: vi.fn().mockResolvedValue({
          targets: [{ entry: { id: 'post-1' }, collection: { name: 'posts' } }],
          blockers: [createBlocker()],
        }),
        dialogDescription: 'Are you sure?',
      });

      await page.getByRole('button', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Assets' });

      await expect
        .element(dialog.getByRole('alert'))
        .toMatchTextContent('These assets can’t be deleted');
      // There’s nothing to confirm
      await expect.element(dialog).not.toMatchTextContent('Are you sure?');
      await expect
        .element(dialog.getByRole('listitem'))
        .toHaveTextContent('Posts › Post 1 Cover: This field is required.');
      await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
    });

    test('works the plan out again each time the dialog opens', async () => {
      const planDeletion = vi
        .fn()
        .mockResolvedValueOnce({ targets: [], blockers: [createBlocker()] })
        .mockResolvedValueOnce({ targets: [], blockers: [] });

      await render(DeleteAssetsButton, {
        assets,
        deleteAssets: vi.fn(),
        planDeletion,
        dialogDescription: 'Are you sure?',
      });

      await page.getByRole('button', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Assets' });

      await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);

      // The entries have been fixed meanwhile
      await page.getByRole('button', { name: 'Delete' }).click();
      await expect
        .element(page.getByRole('alertdialog').getByRole('button', { name: 'Delete' }))
        .toBeEnabled();
      expect(planDeletion).toHaveBeenCalledTimes(2);
    });

    test('checks the fields against their real validation rules', async () => {
      await initTestConfig({
        collections: [
          {
            name: 'posts',
            label: 'Posts',
            folder: 'content/posts',
            fields: [
              { name: 'title', widget: 'string' },
              { name: 'cover', label: 'Cover', widget: 'image' },
              { name: 'photo', label: 'Photo', widget: 'image', required: false },
              { name: 'body', label: 'Body', widget: 'markdown', required: false },
            ],
          },
        ],
      });

      const cover = createMockAsset({ name: 'cover.png' });
      const photo = createMockAsset({ name: 'photo.png' });

      setEntries([
        createMockEntry({
          slug: 'a',
          content: {
            _default: {
              title: 'Post A',
              cover: '/uploads/cover.png',
              photo: '/uploads/photo.png',
              body: 'Hello ![photo](/uploads/photo.png)',
            },
          },
        }),
      ]);

      try {
        await render(DeleteAssetsButton, {
          assets: [photo],
          deleteAssets: vi.fn(),
          planDeletion: planAssetDeletion,
          dialogDescription: 'Are you sure?',
        });
        await page.getByRole('button', { name: 'Delete' }).click();

        const dialog = page.getByRole('alertdialog', { name: 'Delete Asset' });

        // The optional Photo field and the body can be left without it
        await expect
          .element(dialog)
          .toMatchTextContent('The reference to it in an entry will be removed as well.');
        await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeEnabled();
        await dialog.getByRole('button', { name: 'Cancel' }).click();
        await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);

        // The required Cover field can’t
        await render(DeleteAssetsButton, {
          assets: [cover],
          deleteAssets: vi.fn(),
          planDeletion: planAssetDeletion,
          dialogDescription: 'Are you sure?',
        });
        await page.getByRole('button', { name: 'Delete' }).last().click();

        const refusal = page.getByRole('alertdialog', { name: 'Delete Asset' });

        await expect
          .element(refusal.getByRole('listitem'))
          .toHaveTextContent('Posts › Post A Cover: This field is required.');
        await expect.element(refusal.getByRole('button', { name: 'Delete' })).toBeDisabled();
      } finally {
        setEntries([]);
      }
    });
  });
});
