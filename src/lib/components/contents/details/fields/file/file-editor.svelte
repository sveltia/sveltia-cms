<!--
  @component
  Implement the editor for the File and Image field types.
  @see https://decapcms.org/docs/widgets/#File
  @see https://decapcms.org/docs/widgets/#Image
  @see https://sveltiacms.app/en/docs/fields/file
  @see https://sveltiacms.app/en/docs/fields/image
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { ConfirmationDialog, TextArea } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { flushSync, getContext } from 'svelte';
  import { flip } from 'svelte/animate';

  import SelectAssetsDialog from '$lib/components/assets/browser/select-assets-dialog.svelte';
  import ConflictResolutionDialog from '$lib/components/assets/shared/conflict-resolution-dialog.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import RejectedFilesAlertDialog from '$lib/components/assets/shared/rejected-files-alert-dialog.svelte';
  import FileEditorItem from '$lib/components/contents/details/fields/file/file-editor-item.svelte';
  import UploadButton from '$lib/components/contents/details/fields/file/upload-button.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    addMultiValueItems,
    moveMultiValueItem,
    removeMultiValueItem,
  } from '$lib/services/contents/draft/update/list';
  import { checkDuplicates } from '$lib/services/contents/fields/file/duplicates.svelte';
  import { getTargetFolderPath, listAssets } from '$lib/services/contents/fields/file/helpers';
  import { getUnsavedAssets } from '$lib/services/contents/fields/file/process';
  import {
    getMediaFieldAssetOptions,
    getRejectedFileNames,
    processResources,
    toFieldValue,
  } from '$lib/services/contents/fields/file/resources';
  import { getAcceptedImageTypes } from '$lib/services/integrations/media-libraries/default';
  import { isMultiple } from '$lib/services/integrations/media-libraries/shared';
  import { focusReorderControl } from '$lib/services/utils/drag-sorting';
  import { createDragSorter } from '$lib/services/utils/drag-sorting.svelte';

  /**
   * @import {
   * Asset,
   * FieldEditorContext,
   * FieldEditorProps,
   * SelectedResource,
   * } from '$lib/types/private';
   * @import { FileField, MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const {
    valueStoreKey = 'currentValues',
    fieldContext = undefined,
    parentComponentNames = [],
  } = getContext('field-editor') ?? {};
  const inEditorComponent = fieldContext === 'rich-text-editor-component';
  const componentName = parentComponentNames.at(-1);

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let showSelectAssetsDialog = $state(false);
  let replaceMode = $state(false);
  let replaceIndex = $state(-1);
  let showRejectedFilesAlert = $state(false);
  let showPhotoCreditDialog = $state(false);
  let photoCredit = $state('');
  /** @type {DropZone | undefined} */
  let dropZone = $state();
  let processing = $state(false);
  /** @type {string[]} */
  let oversizedFileNames = $state([]);
  /** @type {string[]} */
  let invalidFileNames = $state([]);
  /** @type {File[]} */
  let pendingFiles = $state([]);
  /** @type {Asset[]} */
  let unsavedAssets = $state([]);
  /** @type {HTMLElement | undefined} */
  let itemList = $state();

  const {
    widget: fieldType,
    // Field type-specific options
    max = Infinity,
    accept,
    choose_url: canEnterURL = true,
  } = $derived(fieldConfig);
  /** Whether the field takes a folder instead of a file, with the File field’s own option. */
  const selectFolder = $derived(
    fieldType === 'file' && /** @type {FileField} */ (fieldConfig).select_folder === true,
  );
  const entry = $derived(entryDraft.current?.originalEntry);
  /* v8 ignore start -- the editor is only rendered while the draft is there */
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  const fileName = $derived(entryDraft.current?.fileName);
  const isIndexFile = $derived(entryDraft.current?.isIndexFile ?? false);
  /* v8 ignore stop */
  const isImageField = $derived(fieldType === 'image');
  const kind = $derived(isImageField ? 'image' : undefined);
  const assetOptions = $derived(
    getMediaFieldAssetOptions({
      collectionName,
      fileName,
      isIndexFile,
      componentName,
      typedKeyPath,
      fieldConfig,
    }),
  );
  const libraryConfig = $derived(assetOptions.libraryConfig);
  // An image field accepts HEIC photos only if they’re converted on upload
  const acceptedTypes = $derived(
    accept ??
      (isImageField ? getAcceptedImageTypes(libraryConfig.transformations).join(',') : undefined),
  );
  const assetLibraryFolderMap = $derived(assetOptions.folderMap);
  const targetFolder = $derived(assetOptions.folder);
  const targetFolderPath = $derived(
    getTargetFolderPath({ entry: entryDraft.current?.originalEntry, folder: targetFolder }),
  );
  const listedAssets = $derived(
    listAssets({
      kind,
      folder: targetFolder,
      folderPath: targetFolderPath,
      unsavedAssets,
      slugificationEnabled: libraryConfig.slugify_filename,
    }),
  );
  const multiple = $derived(isMultiple(fieldConfig));
  /* v8 ignore start -- only read while the list of files is rendered */
  const itemCount = $derived(Array.isArray(currentValue) ? currentValue.length : 0);
  /* v8 ignore stop */
  const maxSize = $derived(/** @type {number} */ (libraryConfig.max_file_size));
  /**
   * Whether a single file can be removed here. A required field can’t go without one, and within a
   * rich text editor component or a list item it’s the component or the item that gets removed.
   * @see https://github.com/sveltia/sveltia-cms/issues/372
   */
  const showRemoveButton = $derived(
    !required &&
      (!fieldContext ||
        !['rich-text-editor-component', 'single-subfield-list-field'].includes(fieldContext)),
  );
  const itemArgs = $derived({
    fieldConfig,
    readonly,
    invalid,
    required,
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    entry,
  });
  const enabledCloudServiceEntries = $derived(assetOptions.cloudServiceEntries);
  /**
   * Whether the default (internal) media library is available as a storage provider.
   */
  const isDefaultLibraryAvailable = $derived(assetOptions.enabled && !!targetFolder);
  /**
   * The total number of available media storage providers (default and/or cloud).
   */
  const totalProviders = $derived(
    (isDefaultLibraryAvailable ? 1 : 0) + enabledCloudServiceEntries.length,
  );
  /**
   * Disable the drop zone if there are no providers or multiple providers are available, to avoid
   * confusion about where dropped files will be stored. A folder can’t be dropped at all.
   */
  const allowDrop = $derived(totalProviders === 1 && !selectFolder);

  /**
   * Reset the current selection.
   */
  const resetSelection = () => {
    dropZone?.reset();

    if (!multiple) {
      currentValue = '';
      flushSync();
    }
  };

  /**
   * Handle selected resources.
   * @param {SelectedResource[]} selectedResources Selected resources.
   */
  const onResourcesSelect = async (selectedResources) => {
    const draft = entryDraft.current;

    // The dialog is closed along with the editor, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    // Save the current value so we can restore it if all resources fail validation
    const previousValue = multiple ? undefined : currentValue;

    resetSelection();
    processing = true;
    oversizedFileNames = [];
    invalidFileNames = [];

    // The field must not stay in the processing state if something goes wrong along the way
    try {
      const resources = await processResources({
        draft,
        resources: selectedResources,
        folder: targetFolder,
        libraryConfig,
      });

      const values = resources.flatMap(({ value }) => value ?? []);
      const hasValidResource = !!values.length;

      if (multiple) {
        addMultiValueItems({
          draft,
          locale,
          valueStoreKey,
          keyPath,
          newValues: values,
          replaceIndex: replaceMode ? replaceIndex : undefined,
        });
      } else if (hasValidResource) {
        // A single-value field takes the last file, like it would if they were picked in turn
        currentValue = toFieldValue(/** @type {string} */ (values.at(-1)), inEditorComponent);
      }

      const credits = resources.flatMap(({ credit }) => credit || []);

      ({ oversizedFileNames, invalidFileNames } = getRejectedFileNames(resources));

      // Restore the previous value if no valid resources were processed, so that a failed
      // upload/replace doesn’t leave an empty or invalid reference in the YAML
      if (!hasValidResource && !multiple && previousValue !== undefined) {
        currentValue = previousValue;
      }

      if (credits.length) {
        photoCredit = credits.join('\n');
        showPhotoCreditDialog = true;
      } else {
        photoCredit = '';
      }

      if (oversizedFileNames.length || invalidFileNames.length) {
        showRejectedFilesAlert = true;
      }
    } finally {
      processing = false;
    }
  };

  /**
   * Handle drop event.
   * @param {object} detail Drop event detail.
   * @param {File[]} detail.files Dropped files.
   */
  const onDrop = async ({ files }) => {
    if (!files.length) {
      return;
    }

    if (isDefaultLibraryAvailable) {
      const replace = await checkDuplicates({ files, listedAssets });

      if (replace === undefined) {
        // User cancelled the dialog
        return;
      }

      onResourcesSelect(files.map((file) => ({ file, folder: targetFolder, replace })));
    } else {
      // Open the dialog and pass files to the cloud service panel for upload
      pendingFiles = files;
      showSelectAssetsDialog = true;
    }
  };

  /**
   * Remove an item from the list.
   *
   * The new list is deliberately not assigned to {@link currentValue}: `<FieldEditor>` binds the
   * prop with a getter that recomputes it from the draft, so writing to it here would be discarded
   * anyway. Updating the draft is what makes the list re-render.
   * @param {number} index Index of the item to remove.
   */
  const removeItem = (index) => {
    const draft = entryDraft.current;

    // The items are gone along with the draft, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    removeMultiValueItem({ draft, locale, valueStoreKey, keyPath, index });
  };

  /**
   * Move an item to another position in the list.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   * @param {string} [action] `data-action` of the reorder control that triggered the move, so the
   * focus can be restored to the matching control on the item once it has moved.
   */
  const moveItem = async (from, to, action = 'reorder') => {
    const draft = entryDraft.current;

    // The items are gone along with the draft, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    moveMultiValueItem({ draft, locale, valueStoreKey, keyPath, from, to });

    await sleep(50);
    focusReorderControl({ listElement: itemList, index: to, action });
  };

  const sorter = createDragSorter({
    /**
     * Get the number of items in the list.
     * @returns {number} Item count.
     */
    getItemCount: () => itemCount,
    /**
     * Get the list element.
     * @returns {HTMLElement | undefined} Element.
     */
    getListElement: () => itemList,
    onMove: moveItem,
  });

  $effect(() => {
    const draft = entryDraft.current;

    // The editor is closed along with the draft, so this is only a race with the editor closing
    /* v8 ignore next 3 */
    if (!draft) {
      return;
    }

    (async () => {
      // The draft’s files are read synchronously, so their changes are tracked as well
      unsavedAssets = await getUnsavedAssets({ draft, targetFolderPath });
    })();
  });
</script>

{#snippet uploadButton()}
  <UploadButton
    {allowDrop}
    {invalid}
    {readonly}
    {processing}
    {isImageField}
    {multiple}
    {selectFolder}
    bind:showSelectAssetsDialog
    bind:replaceMode
    onFilePaste={selectFolder
      ? undefined
      : (file) => {
          onResourcesSelect([{ file, folder: targetFolder }]);
        }}
  />
{/snippet}

{#snippet content()}
  {#if !!currentValue?.length && !processing}
    {#if multiple}
      {#if Array.isArray(currentValue)}
        <div
          role="none"
          class="item-list"
          bind:this={itemList}
          ondragovercapture={sorter.onDragOver}
          ondropcapture={sorter.onDrop}
        >
          {#each sorter.displayOrder as index (`${currentValue[index]}|${index}`)}
            <!--
              The wrapper is what the `flip` animation moves: `animate:` only works on an element at
              the top level of a keyed `each` block, not on a component.
            -->
            <div role="none" animate:flip={{ duration: 200 }}>
              <FileEditorItem
                {...itemArgs}
                {index}
                {itemCount}
                value={currentValue[index]}
                fieldId="{fieldId}-{index}"
                dragging={sorter.dragIndex === index}
                onReplace={() => {
                  replaceMode = true;
                  replaceIndex = index;
                  showSelectAssetsDialog = true;
                }}
                onRemove={() => removeItem(index)}
                onDragStart={() => sorter.onDragStart(index)}
                onDragEnd={sorter.onDragEnd}
                onMove={(to, action) => moveItem(index, to, action)}
              />
            </div>
          {/each}
        </div>
        {#if currentValue.length < max}
          {@render uploadButton()}
        {/if}
      {/if}
    {:else if typeof currentValue === 'string' && currentValue}
      <FileEditorItem
        {...itemArgs}
        value={currentValue}
        {fieldId}
        onReplace={() => {
          replaceMode = true;
          showSelectAssetsDialog = true;
        }}
        onRemove={showRemoveButton ? resetSelection : undefined}
      />
    {/if}
  {:else}
    {@render uploadButton()}
  {/if}
{/snippet}

{#if allowDrop}
  <!--
    The drop zone is disabled while an item is being reordered: a reorder drag carries no file, so
    letting it land anywhere outside the item list would only report an unsupported file type.
  -->
  <DropZone
    bind:this={dropZone}
    {multiple}
    disabled={readonly || sorter.dragIndex !== undefined}
    accept={acceptedTypes}
    {onDrop}
  >
    {@render content()}
  </DropZone>
{:else}
  {@render content()}
{/if}

<SelectAssetsDialog
  {kind}
  multiple={replaceMode ? false : multiple}
  accept={acceptedTypes}
  {canEnterURL}
  {selectFolder}
  draft={entryDraft.current}
  {fieldConfig}
  {assetLibraryFolderMap}
  {enabledCloudServiceEntries}
  bind:open={showSelectAssetsDialog}
  bind:pendingFiles
  onSelect={onResourcesSelect}
/>

<ConflictResolutionDialog />

<RejectedFilesAlertDialog
  bind:open={showRejectedFilesAlert}
  {oversizedFileNames}
  {invalidFileNames}
  {maxSize}
/>

<ConfirmationDialog
  bind:open={showPhotoCreditDialog}
  title={_('assets_dialog.photo_credit.title')}
  okLabel={_('copy')}
  onOk={() => {
    navigator.clipboard.writeText(photoCredit);
  }}
>
  <div role="none">{_('assets_dialog.photo_credit.description')}</div>
  <div role="none">
    <TextArea
      dir="auto"
      flex
      readonly
      value={photoCredit}
      onclick={(event) => {
        /** @type {HTMLTextAreaElement} */ (event.target).focus();
        /** @type {HTMLTextAreaElement} */ (event.target).select();
      }}
    />
  </div>
</ConfirmationDialog>

<style>
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 4px;

    & ~ :global([role='button']) {
      margin-top: calc(4px + var(--sui-focus-ring-width));
    }
  }
</style>
