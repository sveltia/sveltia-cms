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
  import { entryDraft } from '$lib/services/contents/draft';
  import {
    moveMultiValueItem,
    removeMultiValueItem,
  } from '$lib/services/contents/draft/update/list';
  import { checkDuplicates } from '$lib/services/contents/fields/file/duplicates.svelte';
  import {
    getAssetLibraryFolderMap,
    getDefaultAssetFolder,
    getTargetFolderPath,
    listAssets,
  } from '$lib/services/contents/fields/file/helpers';
  import { getUnsavedAssets, processResource } from '$lib/services/contents/fields/file/process';
  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { isMultiple } from '$lib/services/integrations/media-libraries/shared';
  import {
    getDropIndex,
    getListItemAt,
    getMoveTarget,
    moveListItem,
    startAutoScroll,
    stopAutoScroll,
  } from '$lib/services/utils/drag-sorting';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @import {
   * Asset,
   * FieldEditorContext,
   * FieldEditorProps,
   * SelectedResource,
   * } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MediaField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

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
  /**
   * Index of the item currently being dragged.
   * @type {number | undefined}
   */
  let dragIndex = $state();
  /**
   * Item indexes in the order they are displayed. While an item is being dragged, this holds the
   * provisional order, so the other items slide out of the way and the gap the dragged item would
   * land in follows the pointer. `undefined` while no drag is in progress.
   * @type {number[] | undefined}
   */
  let previewOrder = $state();

  const {
    widget: fieldType,
    // Field type-specific options
    max = Infinity,
    accept,
    choose_url: canEnterURL = true,
  } = $derived(fieldConfig);
  const entry = $derived($entryDraft?.originalEntry);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const isImageField = $derived(fieldType === 'image');
  const kind = $derived(isImageField ? 'image' : undefined);
  const defaultLibraryOptions = $derived(getDefaultMediaLibraryOptions({ fieldConfig }));
  const libraryConfig = $derived(defaultLibraryOptions.config);
  const assetLibraryFolderMap = $derived(
    getAssetLibraryFolderMap({
      collectionName,
      fileName,
      componentName,
      typedKeyPath,
      isIndexFile,
    }),
  );
  const targetFolder = $derived(getDefaultAssetFolder(assetLibraryFolderMap));
  const targetFolderPath = $derived(
    getTargetFolderPath({ entry: $entryDraft?.originalEntry, folder: targetFolder }),
  );
  const listedAssets = $derived(
    listAssets({ kind, folder: targetFolder, folderPath: targetFolderPath, unsavedAssets }),
  );
  const multiple = $derived(isMultiple(fieldConfig));
  const itemCount = $derived(Array.isArray(currentValue) ? currentValue.length : 0);
  /**
   * The order the items are rendered in. This is the identity order except during a drag. A stale
   * preview left over from a list that changed length underneath is discarded.
   * @type {number[]}
   */
  const displayOrder = $derived(
    previewOrder?.length === itemCount ? previewOrder : [...Array(itemCount).keys()],
  );
  const maxSize = $derived(/** @type {number} */ (libraryConfig.max_file_size));
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
    showRemoveButton,
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    entry,
  });
  const enabledCloudServiceEntries = $derived(
    Object.entries(allCloudStorageServices).filter(
      ([, { isEnabled }]) => isEnabled?.(fieldConfig) ?? true,
    ),
  );
  /**
   * Whether the default (internal) media library is available as a storage provider.
   */
  const isDefaultLibraryAvailable = $derived(defaultLibraryOptions.enabled && !!targetFolder);
  /**
   * The total number of available media storage providers (default and/or cloud).
   */
  const totalProviders = $derived(
    (isDefaultLibraryAvailable ? 1 : 0) + enabledCloudServiceEntries.length,
  );
  /**
   * Disable the drop zone if there are no providers or multiple providers are available, to avoid
   * confusion about where dropped files will be stored.
   */
  const allowDrop = $derived(totalProviders === 1);

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
    if (!$entryDraft) {
      return;
    }

    // Save the current value so we can restore it if all resources fail validation
    const previousValue = multiple ? undefined : currentValue;

    resetSelection();
    processing = true;
    oversizedFileNames = [];
    invalidFileNames = [];

    const resources = await Promise.all(
      selectedResources.map((resource) => {
        // Set the target folder for non-hotlinking stock assets from Pexels, etc.
        if (resource.file && !resource.folder) {
          resource.folder = targetFolder;
        }

        return processResource({ draft: $entryDraft, resource, libraryConfig });
      }),
    );

    /** @type {string[]} */
    const credits = [];
    let hasValidResource = false;

    const lastIndex = multiple
      ? (Object.keys($entryDraft[valueStoreKey][locale])
          .filter((key) => key.startsWith(`${keyPath}.`))
          .map((key) => Number(key.replace(`${keyPath}.`, '')))
          .pop() ?? -1)
      : -1;

    resources.forEach(({ value, credit, oversizedFileName, invalidFileName }, index) => {
      if (value) {
        hasValidResource = true;

        if (multiple) {
          const targetIndex = replaceMode ? replaceIndex : lastIndex + 1 + index;

          $entryDraft[valueStoreKey][locale][`${keyPath}.${targetIndex}`] = value;
        } else {
          // Encode spaces as `%20` when the field is used in the rich text editor component to
          // avoid issues with Markdown parsers that do not support unencoded spaces in URLs.
          currentValue = inEditorComponent ? value.replaceAll(' ', '%20') : value;
        }
      }

      if (credit) {
        credits.push(credit);
      }

      if (oversizedFileName) {
        oversizedFileNames.push(oversizedFileName);
      }

      if (invalidFileName) {
        invalidFileNames.push(invalidFileName);
      }
    });

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

    processing = false;
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
   * The new list is deliberately not assigned to {@link currentValue}: a multi-value field gets the
   * prop one way from the parent, so a local write turns it into an override that keeps its value
   * even after the parent recomputes. The list would then stop following the draft, and images
   * added after a removal wouldn’t show up until the next removal reset it.
   * @param {number} index Index of the item to remove.
   */
  const removeItem = (index) => {
    if (!$entryDraft) {
      return;
    }

    removeMultiValueItem({ locale, valueStoreKey, keyPath, index });
  };

  /**
   * Move an item to another position in the list.
   * @param {number} from Source index.
   * @param {number} to Destination index.
   * @param {string} [action] `data-action` of the reorder control that triggered the move, so the
   * focus can be restored to the matching control on the item once it has moved.
   */
  const moveItem = async (from, to, action = 'reorder') => {
    if (!$entryDraft) {
      return;
    }

    moveMultiValueItem({ locale, valueStoreKey, keyPath, from, to });

    await sleep(50);
    // Move the focus back to the control on the item that was just moved, so that it can be used
    // repeatedly without having to find it again
    /** @type {HTMLElement | null | undefined} */ (
      itemList?.children[to]?.querySelector(`button[data-action="${action}"]`)
    )?.focus();
  };

  /**
   * Handle a `dragover` event fired while an item is being reordered.
   *
   * The list-level drag handlers run in the capture phase, so that the surrounding drop zone never
   * sees a reorder drag and doesn’t offer to upload the item as a file. Anything else being
   * dragged, such as a file from the desktop, is passed through untouched.
   * @param {DragEvent} event `dragover` event.
   */
  const onDragOver = (event) => {
    if (dragIndex === undefined || !previewOrder) {
      return;
    }

    event.stopPropagation();
    // The browser rejects the drop and never fires the `drop` event unless the default is prevented
    event.preventDefault();

    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'move';
    }

    const item = getListItemAt({ target: event.target, listElement: itemList });

    // Keep the current order while the pointer is over a gap between two items
    if (!item) {
      return;
    }

    const from = previewOrder.indexOf(dragIndex);

    const to = getMoveTarget({
      dragIndex: from,
      dropIndex: getDropIndex({
        index: item.index,
        clientY: event.clientY,
        rect: item.element.getBoundingClientRect(),
      }),
    });

    if (to !== undefined) {
      previewOrder = moveListItem(previewOrder, from, to);
    }
  };

  /**
   * Handle a `drop` event fired while an item is being reordered.
   * @param {DragEvent} event `drop` event.
   */
  const onItemDrop = (event) => {
    if (dragIndex === undefined) {
      return;
    }

    event.stopPropagation();
    event.preventDefault();
    stopAutoScroll();

    const from = dragIndex;
    // Where the item ended up in the preview is where it should be committed
    const to = previewOrder?.indexOf(dragIndex) ?? from;

    dragIndex = undefined;
    // The committed order matches the preview, so the items don’t move again on the way out
    previewOrder = undefined;

    if (to !== from) {
      moveItem(from, to);
    }
  };

  $effect(() => {
    (async () => {
      if ($entryDraft?.files) {
        unsavedAssets = await getUnsavedAssets({ draft: $entryDraft, targetFolderPath });
      } else {
        unsavedAssets = [];
      }
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
    bind:showSelectAssetsDialog
    bind:replaceMode
    onFilePaste={(file) => {
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
          ondragovercapture={onDragOver}
          ondropcapture={onItemDrop}
        >
          {#each displayOrder as index (`${currentValue[index]}|${index}`)}
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
                dragging={dragIndex === index}
                onReplace={() => {
                  replaceMode = true;
                  replaceIndex = index;
                  showSelectAssetsDialog = true;
                }}
                onRemove={() => removeItem(index)}
                onDragStart={() => {
                  dragIndex = index;
                  previewOrder = [...displayOrder];
                  // Let the editor pane scroll while the pointer is dragged near its top or bottom
                  // edge, so a long list can be reordered without letting go
                  startAutoScroll(itemList);
                }}
                onDragEnd={() => {
                  stopAutoScroll();
                  dragIndex = undefined;
                  // A cancelled drag puts every item back where it started
                  previewOrder = undefined;
                }}
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
        onRemove={resetSelection}
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
    disabled={readonly || dragIndex !== undefined}
    accept={accept ?? (isImageField ? SUPPORTED_IMAGE_TYPES.join(',') : undefined)}
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
  {accept}
  {canEnterURL}
  {entryDraft}
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
