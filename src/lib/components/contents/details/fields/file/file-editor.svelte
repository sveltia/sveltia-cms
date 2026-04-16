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
  import { AlertDialog, ConfirmationDialog, TextArea } from '@sveltia/ui';
  import { flushSync, getContext } from 'svelte';

  import SelectAssetsDialog from '$lib/components/assets/browser/select-assets-dialog.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import FileEditorItem from '$lib/components/contents/details/fields/file/file-editor-item.svelte';
  import UploadButton from '$lib/components/contents/details/fields/file/upload-button.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getAssetLibraryFolderMap } from '$lib/services/contents/fields/file/helper';
  import { processResource } from '$lib/services/contents/fields/file/process';
  import { allCloudStorageServices } from '$lib/services/integrations/media-libraries/cloud';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { isMultiple } from '$lib/services/integrations/media-libraries/shared';
  import { formatSize } from '$lib/services/utils/file';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @import {
   * AssetFolderInfo,
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
  const { fieldContext = undefined } = getContext('field-editor') ?? {};
  const inEditorComponent = fieldContext === 'rich-text-editor-component';

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
  let showSizeLimitDialog = $state(false);
  let showPhotoCreditDialog = $state(false);
  let photoCredit = $state('');
  /** @type {DropZone | undefined} */
  let dropZone = $state();
  let processing = $state(false);
  /** @type {string[]} */
  let oversizedFileNames = $state([]);
  /** @type {File[]} */
  let pendingFiles = $state([]);

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
  const defaultLibraryOptions = $derived(getDefaultMediaLibraryOptions({ fieldConfig }));
  const libraryConfig = $derived(defaultLibraryOptions.config);
  const assetLibraryFolderMap = $derived(
    getAssetLibraryFolderMap({ collectionName, fileName, typedKeyPath, isIndexFile }),
  );
  const targetFolder = $derived(
    /** @type {AssetFolderInfo} */ (
      Object.values(assetLibraryFolderMap).find(({ enabled }) => enabled)?.folder
    ),
  );
  // Ignore the `multiple` option when the field is used in a rich text editor component
  const multiple = $derived(isMultiple(fieldConfig) && !inEditorComponent);
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

    const resources = await Promise.all(
      selectedResources.map((resource) =>
        processResource({ draft: $entryDraft, resource, libraryConfig }),
      ),
    );

    /** @type {string[]} */
    const credits = [];
    let hasValidResource = false;

    const lastIndex = multiple
      ? (Object.keys($entryDraft.currentValues[locale])
          .filter((key) => key.startsWith(`${keyPath}.`))
          .map((key) => Number(key.replace(`${keyPath}.`, '')))
          .pop() ?? -1)
      : -1;

    resources.forEach(({ value, credit, oversizedFileName }, index) => {
      if (value) {
        hasValidResource = true;

        if (multiple) {
          const targetIndex = replaceMode ? replaceIndex : lastIndex + 1 + index;

          $entryDraft.currentValues[locale][`${keyPath}.${targetIndex}`] = value;
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
    });

    // Restore the previous value if no valid resources were processed, so that a failed
    // upload/replace doesn't leave an empty or invalid reference in the YAML
    if (!hasValidResource && !multiple && previousValue !== undefined) {
      currentValue = previousValue;
    }

    if (credits.length) {
      photoCredit = credits.join('\n');
      showPhotoCreditDialog = true;
    } else {
      photoCredit = '';
    }

    if (oversizedFileNames.length) {
      showSizeLimitDialog = true;
    }

    processing = false;
  };

  /**
   * Handle drop event.
   * @param {object} detail Drop event detail.
   * @param {File[]} detail.files Dropped files.
   */
  const onDrop = ({ files }) => {
    if (!files.length) {
      return;
    }

    if (isDefaultLibraryAvailable) {
      onResourcesSelect(files.map((file) => ({ file, folder: targetFolder })));
    } else {
      // Open the dialog and pass files to the cloud service panel for upload
      pendingFiles = files;
      showSelectAssetsDialog = true;
    }
  };

  /**
   * Remove an item from the list.
   * @param {number} index Index of the item to remove.
   */
  const removeItem = (index) => {
    if (!$entryDraft) {
      return;
    }

    const valueMap = $state.snapshot($entryDraft.currentValues[locale]);
    /** @type {string[]} */
    const updatedValue = [];

    for (let i = 0; ; i += 1) {
      const currentKey = `${keyPath}.${i}`;
      const nextKey = `${keyPath}.${i + 1}`;

      if (i < index) {
        updatedValue.push(valueMap[currentKey]);
      } else if (nextKey in valueMap) {
        updatedValue.push(valueMap[nextKey]);
        $entryDraft.currentValues[locale][currentKey] = valueMap[nextKey];
      } else {
        $entryDraft.currentValues[locale][currentKey] = null;
        delete $entryDraft.currentValues[locale][currentKey];
        break;
      }
    }

    currentValue = Object.values(updatedValue);
  };

  /**
   * Move an item down in the list.
   * @param {number} index Index of the item to move down.
   */
  const moveDown = (index) => {
    if (!$entryDraft) {
      return;
    }

    [
      $entryDraft.currentValues[locale][`${keyPath}.${index}`],
      $entryDraft.currentValues[locale][`${keyPath}.${index + 1}`],
    ] = [
      $entryDraft.currentValues[locale][`${keyPath}.${index + 1}`],
      $entryDraft.currentValues[locale][`${keyPath}.${index}`],
    ];
  };
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
        <div role="none" class="item-list">
          {#each currentValue as value, index (`${value}|${index}`)}
            <FileEditorItem
              {...itemArgs}
              {value}
              fieldId="{fieldId}-{index}"
              onReplace={() => {
                replaceMode = true;
                replaceIndex = index;
                showSelectAssetsDialog = true;
              }}
              onRemove={() => removeItem(index)}
              onMoveUp={index > 0 ? () => moveDown(index - 1) : undefined}
              onMoveDown={index < currentValue.length - 1 ? () => moveDown(index) : undefined}
            />
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
  <DropZone
    bind:this={dropZone}
    {multiple}
    disabled={readonly}
    accept={accept ?? (isImageField ? SUPPORTED_IMAGE_TYPES.join(',') : undefined)}
    {onDrop}
  >
    {@render content()}
  </DropZone>
{:else}
  {@render content()}
{/if}

<SelectAssetsDialog
  kind={isImageField ? 'image' : undefined}
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

<AlertDialog bind:open={showSizeLimitDialog} title={_('assets_dialog.large_file.title')}>
  {_('warning_oversized_files', {
    values: { count: oversizedFileNames.length, size: formatSize(maxSize) },
  })}
</AlertDialog>

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

<style lang="scss">
  .item-list {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
</style>
