import { describe, expect, onTestFinished, test, vi } from 'vitest';
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
    await page.getByRole('menuitem', { name: 'Delete' }).click();
    await expect.element(page.getByRole('alertdialog', { name: 'Delete Assets' })).toBeVisible();
  });

  test('moves the focus to the asset list once the focused button is disabled', async () => {
    // The asset list next to the toolbar, with the row in the tab order
    const pageContainer = document.createElement('div');

    pageContainer.id = 'page-container';
    pageContainer.innerHTML = '<div role="grid"><div role="row" tabindex="0">a.png</div></div>';
    document.body.append(pageContainer);
    onTestFinished(() => {
      pageContainer.remove();
    });

    const props = $state({ assets, deleteAssets: vi.fn(), buttonDescription: 'Delete Assets' });

    await render(DeleteAssetsButton, props);

    const button = page.getByRole('button', { name: 'Delete Assets' });

    await expect.element(button).toBeEnabled();
    button.element().focus();
    // The selected assets have been deleted
    props.assets = [];
    await expect.element(page.getByRole('row')).toHaveFocus();
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

    test('ignores a plan that arrives after the dialog has been reopened', async () => {
      const first = /** @type {PromiseWithResolvers<any>} */ (Promise.withResolvers());
      const second = /** @type {PromiseWithResolvers<any>} */ (Promise.withResolvers());

      const planDeletion = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockReturnValue(second.promise);

      const { rerender } = await render(DeleteAssetsButton, {
        assets: [assets[0]],
        deleteAssets: vi.fn(),
        planDeletion,
        dialogDescription: 'Are you sure?',
      });

      await page.getByRole('button', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Asset' });

      await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);

      // The dialog is reopened for another selection while the first plan is still on its way
      await rerender({ assets });
      await page.getByRole('button', { name: 'Delete' }).click();
      expect(planDeletion).toHaveBeenLastCalledWith(assets);

      first.resolve({ targets: [], blockers: [createBlocker()] });

      // The stale plan doesn’t refuse the new deletion
      const reopened = page.getByRole('alertdialog', { name: 'Delete Assets' });

      await expect.element(reopened).toHaveTextContent('Delete Assets Are you sure? Delete Cancel');
      await expect.element(reopened.getByRole('button', { name: 'Delete' })).toBeDisabled();

      second.resolve({ targets: [], blockers: [] });
      await expect.element(reopened.getByRole('button', { name: 'Delete' })).toBeEnabled();
    });

    test('reports a plan that can’t be worked out, which is tried again once reopened', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      const planDeletion = vi
        .fn()
        .mockRejectedValueOnce(new Error('Boom'))
        .mockResolvedValueOnce({ targets: [], blockers: [] });

      await render(DeleteAssetsButton, {
        assets,
        deleteAssets: vi.fn(),
        planDeletion,
        dialogDescription: 'Are you sure?',
      });

      await page.getByRole('button', { name: 'Delete' }).click();

      const dialog = page.getByRole('alertdialog', { name: 'Delete Assets' });

      await expect
        .element(dialog.getByRole('alert'))
        .toHaveTextContent(
          'Couldn’t check which entries use these assets. Close this dialog and try again.',
        );
      // There’s nothing to confirm
      await expect.element(dialog).not.toMatchTextContent('Are you sure?');
      await expect.element(dialog.getByRole('button', { name: 'Delete' })).toBeDisabled();
      expect(consoleError).toHaveBeenCalledWith(new Error('Boom'));

      await dialog.getByRole('button', { name: 'Cancel' }).click();
      await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);
      await page.getByRole('button', { name: 'Delete' }).click();

      const reopened = page.getByRole('alertdialog', { name: 'Delete Assets' });

      await expect.element(reopened.getByRole('button', { name: 'Delete' })).toBeEnabled();
      await expect.element(reopened).toHaveTextContent('Delete Assets Are you sure? Delete Cancel');
    });

    test('ignores a plan that fails after the dialog has been reopened', async () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      const first = /** @type {PromiseWithResolvers<any>} */ (Promise.withResolvers());

      const planDeletion = vi
        .fn()
        .mockReturnValueOnce(first.promise)
        .mockResolvedValue({ targets: [], blockers: [] });

      const { rerender } = await render(DeleteAssetsButton, {
        assets: [assets[0]],
        deleteAssets: vi.fn(),
        planDeletion,
        dialogDescription: 'Are you sure?',
      });

      await page.getByRole('button', { name: 'Delete' }).click();
      await page
        .getByRole('alertdialog', { name: 'Delete Asset' })
        .getByRole('button', { name: 'Cancel' })
        .click();
      await expect.poll(() => page.getByRole('alertdialog').elements().length).toBe(0);

      await rerender({ assets });
      await page.getByRole('button', { name: 'Delete' }).click();

      const reopened = page.getByRole('alertdialog', { name: 'Delete Assets' });

      await expect.element(reopened.getByRole('button', { name: 'Delete' })).toBeEnabled();
      first.reject(new Error('Boom'));
      await vi.waitFor(() => expect(consoleError).toHaveBeenCalled());
      expect(reopened.getByRole('alert').elements()).toHaveLength(0);
      await expect.element(reopened.getByRole('button', { name: 'Delete' })).toBeEnabled();
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
