<!--
  @component
  Let a custom field control open the same Select Assets dialog as a built-in File/Image field. The
  dialog is opened imperatively with `pick()`, which resolves with what the user picked, so that a
  React control can `await` it the way it awaits `addFile()`.
-->
<script>
  import { onDestroy } from 'svelte';

  import SelectAssetsDialog from '$lib/components/assets/browser/select-assets-dialog.svelte';
  import ConflictResolutionDialog from '$lib/components/assets/shared/conflict-resolution-dialog.svelte';
  import RejectedFilesAlertDialog from '$lib/components/assets/shared/rejected-files-alert-dialog.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    getCustomFieldAssetOptions,
    getPickedAssetKind,
    resolvePickedResources,
  } from '$lib/services/contents/fields/custom/files';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @import { SelectedResource, TypedFieldKeyPath } from '$lib/types/private';
   * @import {
   * CustomField,
   * CustomFieldPickFileOptions,
   * CustomFieldPickedFile,
   * MediaField,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CustomField} fieldConfig Field configuration.
   * @property {TypedFieldKeyPath} typedKeyPath Typed key path to the field.
   * @property {string} [componentName] Name of the rich text editor component the field is part
   * of, if any.
   * @property {boolean} [inEditorComponent] Whether the field is rendered in a rich text editor
   * component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    fieldConfig,
    typedKeyPath,
    componentName = undefined,
    inEditorComponent = false,
    /* eslint-enable prefer-const */
  } = $props();

  const entryDraft = getEntryDraftContext();

  let open = $state(false);
  /** @type {CustomFieldPickFileOptions} */
  let options = $state.raw({});
  let showRejectedFilesAlert = $state(false);
  /** @type {string[]} */
  let oversizedFileNames = $state([]);
  /** @type {string[]} */
  let invalidFileNames = $state([]);
  /**
   * Settles the promise returned by the pending `pick()` call. `undefined` while nothing is
   * pending. The resolver is dropped as soon as a selection is made, so that the dialog closing
   * afterwards doesn’t resolve the same call again with `null`.
   * @type {PromiseWithResolvers<CustomFieldPickedFile | CustomFieldPickedFile[] | null> |
   * undefined}
   */
  let pending;

  const assetOptions = $derived(
    entryDraft.current
      ? getCustomFieldAssetOptions({
          draft: entryDraft.current,
          fieldConfig,
          typedKeyPath,
          componentName,
        })
      : undefined,
  );
  const kind = $derived(getPickedAssetKind(options));
  // The dialog only falls back to the image types once, so give it the types for every pick
  const accept = $derived(
    options.accept ?? (kind === 'image' ? SUPPORTED_IMAGE_TYPES.join(',') : undefined),
  );
  const maxSize = $derived(assetOptions?.libraryConfig.max_file_size ?? Infinity);
  // The dialog only reads the media library options from the field configuration, which a custom
  // field may define the same way as a File/Image field
  const mediaFieldConfig = $derived(/** @type {MediaField} */ (/** @type {any} */ (fieldConfig)));

  /**
   * Open the dialog and wait for the user to pick something. A call made while the dialog is
   * already open shares the outcome of the pending call, since only one pick can be in progress.
   * @param {CustomFieldPickFileOptions} [pickOptions] Options.
   * @returns {Promise<CustomFieldPickedFile | CustomFieldPickedFile[] | null>} Picked file(s), or
   * `null` if the dialog is dismissed or nothing usable is picked.
   * @throws {Error} When no entry is being edited.
   */
  export const pick = async (pickOptions = {}) => {
    if (!entryDraft.current) {
      throw new Error('pickFile() can only be called while an entry is being edited');
    }

    if (!pending) {
      pending = Promise.withResolvers();
      options = pickOptions;
      open = true;
    }

    return pending.promise;
  };

  /**
   * Handle the resources selected in the dialog.
   * @param {SelectedResource[]} resources Selected resources.
   */
  const onSelect = async (resources) => {
    const draft = entryDraft.current;
    const { resolve, reject } = pending ?? {};
    // Read before the await below: another `pick()` call made in the meantime replaces the options
    const { multiple = false } = options;

    pending = undefined;

    if (!resolve || !reject) {
      return;
    }

    // The draft may have gone away while the dialog was closing; nothing can be picked then
    if (!draft) {
      resolve(null);

      return;
    }

    try {
      const { files, ...rejected } = await resolvePickedResources({
        draft,
        fieldConfig,
        typedKeyPath,
        componentName,
        inEditorComponent,
        resources,
      });

      ({ oversizedFileNames, invalidFileNames } = rejected);

      if (oversizedFileNames.length || invalidFileNames.length) {
        showRejectedFilesAlert = true;
      }

      if (!files.length) {
        resolve(null);
      } else if (multiple) {
        resolve(files);
      } else {
        resolve(files[0]);
      }
    } catch (error) {
      reject(error);
    }
  };

  /**
   * Handle the dialog being closed. The call is still pending if the dialog was dismissed rather
   * than closed with the Insert button.
   */
  const onClose = () => {
    pending?.resolve(null);
    pending = undefined;
  };

  // The dialog doesn’t get to close when the editor is left while it’s open, so settle the call
  // here rather than leaving the control waiting forever
  onDestroy(onClose);
</script>

{#if assetOptions}
  <SelectAssetsDialog
    {kind}
    {accept}
    multiple={!!options.multiple}
    canEnterURL={options.allowURL ?? true}
    draft={entryDraft.current}
    fieldConfig={mediaFieldConfig}
    assetLibraryFolderMap={assetOptions.folderMap}
    enabledCloudServiceEntries={assetOptions.cloudServiceEntries}
    bind:open
    {onSelect}
    {onClose}
  />

  <ConflictResolutionDialog />

  <RejectedFilesAlertDialog
    bind:open={showRejectedFilesAlert}
    {oversizedFileNames}
    {invalidFileNames}
    {maxSize}
  />
{/if}
