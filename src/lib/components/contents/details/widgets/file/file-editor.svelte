<!--
  @component
  Implement the editor for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import { AlertDialog, Button, ConfirmationDialog, Icon, TextArea } from '@sveltia/ui';
  import { getHash } from '@sveltia/utils/crypto';
  import equal from 'fast-deep-equal';
  import DOMPurify from 'isomorphic-dompurify';
  import { flushSync } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SelectAssetsDialog from '$lib/components/assets/browser/select-assets-dialog.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import {
    allAssets,
    getAssetByPath,
    getAssetFolder,
    getAssetPublicURL,
    getMediaFieldURL,
    getMediaKind,
    globalAssetFolder,
  } from '$lib/services/assets';
  import { getDefaultMediaLibraryOptions, transformFile } from '$lib/services/assets/media-library';
  import { entryDraft } from '$lib/services/contents/draft';
  import { hasMouse } from '$lib/services/user/env';
  import { createPath, formatSize } from '$lib/services/utils/file';
  import { SUPPORTED_IMAGE_TYPES } from '$lib/services/utils/media/image';

  /**
   * @import {
   * Asset,
   * AssetKind,
   * EntryDraft,
   * SelectedResource,
   * WidgetEditorProps,
   * } from '$lib/types/private';
   * @import { FileField, ImageField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {FileField | ImageField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    context = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {string | undefined} */
  let url;
  /** @type {string | undefined} */
  let credit;

  /** @type {Asset | undefined} */
  let asset = $state();
  /** @type {File | undefined} */
  let file = $state();
  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();
  let showSelectAssetsDialog = $state(false);
  let showSizeLimitDialog = $state(false);
  let showPhotoCreditDialog = $state(false);
  let photoCredit = $state('');
  /** @type {DropZone | undefined} */
  let dropZone = $state();
  let processing = $state(false);

  const {
    widget: widgetName,
    accept,
    // Widget-specific options
    choose_url: canEnterURL = true,
  } = $derived(fieldConfig);
  const isImageWidget = $derived(widgetName === 'image');
  const {
    config: { max_file_size: maxSize, transformations },
  } = $derived(getDefaultMediaLibraryOptions({ fieldConfig }));
  const entry = $derived($entryDraft?.originalEntry);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const fileName = $derived($entryDraft?.fileName);
  const showRemoveButton = $derived(
    !required &&
      (!context || !['markdown-editor-component', 'single-field-list-widget'].includes(context)),
  );

  /**
   * Get the path to display for the asset or file. For an unsaved file, this will be the same as
   * the final path in most cases, but it could be different if a file with the same name already
   * exists in the assets folder, and the new file is renamed to avoid conflicts.
   * @returns {string} The path to display. If the folder could not be determined, it will only
   * return the file name.
   * @todo Handle template tags and relative paths if possible.
   */
  const fileDisplayPath = $derived.by(() => {
    if (!currentValue) {
      return '';
    }

    if (file) {
      const { publicPath, entryRelative, hasTemplateTags } =
        $entryDraft?.files[currentValue].folder ?? {};

      const _folder = entryRelative || hasTemplateTags ? '' : publicPath || '';

      return createPath([_folder, decodeURI(file.name.normalize())]);
    }

    if (!currentValue.startsWith('blob:')) {
      return decodeURI(currentValue);
    }

    return '';
  });

  /**
   * Get the blob URL of an unsaved file that matches the given file.
   * @param {File} _file File to be searched.
   * @returns {Promise<string | undefined>} Blob URL.
   */
  const getExistingBlobURL = async (_file) => {
    const hash = await getHash(_file);
    /** @type {string | undefined} */
    let foundURL = undefined;

    await Promise.all(
      Object.entries($entryDraft?.files ?? {}).map(async ([blobURL, f]) => {
        if (!foundURL && (await getHash(f.file)) === hash) {
          foundURL = blobURL;
        }
      }),
    );

    return foundURL;
  };

  /**
   * Reset the current selection.
   */
  const resetSelection = () => {
    dropZone?.reset();

    // This will reset `file`, `asset`, `kind` and `src` via `updateProps`
    currentValue = '';

    // Force running `updateProps` first, otherwise `file`, `asset`, etc. will be  `undefined` while
    // `await`ing a Promise in `onResourceSelect`
    flushSync();
  };

  /**
   * Handle selected resource.
   * @param {SelectedResource} selectedResource Selected resource.
   */
  const onResourceSelect = async (selectedResource) => {
    processing = true;
    resetSelection();

    ({ asset, file, url, credit } = selectedResource);

    if (file) {
      const existingBlobURL = await getExistingBlobURL(file);

      if (existingBlobURL) {
        currentValue = existingBlobURL;
      } else {
        if (transformations) {
          file = await transformFile(file, transformations);
        }

        const hash = await getHash(file);
        const { folder } = selectedResource;
        const existingAsset = $allAssets.find((a) => a.sha === hash && equal(a.folder, folder));

        if (existingAsset) {
          // If the selected file has already been uploaded, use the existing asset instead of
          // uploading the same file twice
          asset = existingAsset;
          file = undefined;
        } else if (file.size > /** @type {number} */ (maxSize)) {
          showSizeLimitDialog = true;
          file = undefined;
        } else {
          // Set a temporary blob URL, which will be later replaced with the actual file path
          currentValue = URL.createObjectURL(file);
          // Cache the file itself for later upload
          /** @type {EntryDraft} */ ($entryDraft).files[currentValue] = { file, folder };
        }
      }
    }

    if (asset) {
      if (!asset.unsaved) {
        currentValue = getAssetPublicURL(asset, { pathOnly: true, allowSpecial: true, entry });
      } else if (asset.file) {
        currentValue = await getExistingBlobURL(asset.file);
      }
    }

    if (url) {
      currentValue = url;
    }

    if (credit) {
      photoCredit = DOMPurify.sanitize(credit, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href'] });
      showPhotoCreditDialog = true;
    }

    processing = false;
  };

  /**
   * Update a couple of properties when {@link currentValue} is updated.
   */
  const updateProps = async () => {
    // Restore `file` after a draft backup is restored
    if (currentValue?.startsWith('blob:') && $entryDraft) {
      file = $entryDraft.files[currentValue]?.file;
    }

    if (currentValue) {
      const getURLArgs = { value: currentValue, entry, collectionName, fileName };

      // Update the `src` when an asset is selected
      if (currentValue.startsWith('blob:')) {
        asset = undefined;
        kind = currentValue ? await getMediaKind(currentValue) : undefined;
        src =
          currentValue && kind
            ? await getMediaFieldURL({ ...getURLArgs, thumbnail: true })
            : undefined;
      } else if (isImageWidget && /^https?:/.test(currentValue)) {
        asset = undefined;
        kind = 'image';
        src = currentValue;
      } else {
        asset = getAssetByPath({ ...getURLArgs });
        kind = undefined;
        src = undefined;
      }
    } else {
      // Remove `file` after the value is removed
      asset = undefined;
      file = undefined;
      kind = undefined;
      src = undefined;
    }
  };

  $effect(() => {
    void [currentValue];
    updateProps();
  });
</script>

<DropZone
  bind:this={dropZone}
  disabled={readonly}
  accept={accept ?? (isImageWidget ? SUPPORTED_IMAGE_TYPES.join(',') : undefined)}
  onDrop={({ files }) => {
    if (files.length) {
      onResourceSelect({
        file: files[0],
        folder:
          getAssetFolder({ collectionName, fileName }) ??
          getAssetFolder({ collectionName }) ??
          $globalAssetFolder,
      });
    }
  }}
>
  {#if currentValue && !processing}
    <div role="none" class="filled">
      {#if kind && src}
        <AssetPreview {kind} {src} variant="tile" checkerboard={true} />
      {:else if asset}
        <AssetPreview kind={asset.kind} {asset} variant="tile" checkerboard={true} />
      {:else}
        <span role="none" class="preview no-thumbnail">
          <Icon name="draft" />
        </span>
      {/if}
      <div role="none">
        {#if typeof currentValue === 'string'}
          <div
            role="textbox"
            id="{fieldId}-value"
            tabindex="0"
            class="filename"
            aria-readonly={readonly}
            aria-invalid={invalid}
            aria-required={required}
            aria-labelledby="{fieldId}-label"
            aria-errormessage="{fieldId}-error"
          >
            {fileDisplayPath}
          </div>
        {/if}
        <div role="none">
          <Button
            disabled={readonly}
            variant="tertiary"
            label={$_('replace')}
            aria-label={$_(`replace_${widgetName}`)}
            aria-controls="{fieldId}-value"
            onclick={() => {
              showSelectAssetsDialog = true;
            }}
          />
          {#if showRemoveButton}
            <Button
              disabled={readonly}
              variant="tertiary"
              label={$_('remove')}
              aria-label={$_(`remove_${widgetName}`)}
              aria-controls="{fieldId}-value"
              onclick={() => {
                resetSelection();
              }}
            />
          {/if}
        </div>
      </div>
    </div>
  {:else}
    <div role="none" class="empty" class:invalid class:processing>
      <Button
        flex
        role="button"
        variant="tertiary"
        disabled={readonly || processing}
        tabindex="0"
        onclick={() => {
          if (!readonly) {
            showSelectAssetsDialog = true;
          }
        }}
      >
        <Icon name="cloud_upload" />
        <div role="none">
          {#if processing}
            <div role="status">
              {$_('processing_file')}
            </div>
          {:else if isImageWidget}
            {$_($hasMouse ? 'drop_image_file_or_click_to_browse' : 'tap_to_browse')}
          {:else}
            {$_($hasMouse ? 'drop_file_or_click_to_browse' : 'tap_to_browse')}
          {/if}
        </div>
      </Button>
    </div>
  {/if}
</DropZone>

<SelectAssetsDialog
  kind={isImageWidget ? 'image' : undefined}
  {accept}
  {canEnterURL}
  {entryDraft}
  {fieldConfig}
  bind:open={showSelectAssetsDialog}
  onSelect={onResourceSelect}
/>

<AlertDialog bind:open={showSizeLimitDialog} title={$_('assets_dialog.large_file.title')}>
  {$_('warning_oversized_file', { values: { size: formatSize(/** @type {number} */ (maxSize)) } })}
</AlertDialog>

<ConfirmationDialog
  bind:open={showPhotoCreditDialog}
  title={$_('assets_dialog.photo_credit.title')}
  okLabel={$_('copy')}
  onOk={() => {
    navigator.clipboard.writeText(photoCredit);
  }}
>
  <div role="none">{$_('assets_dialog.photo_credit.description')}</div>
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
  .filled {
    display: flex !important;
    align-items: center;
    gap: 16px;
    margin: var(--sui-focus-ring-width);

    :global {
      .preview {
        flex: none;
        width: 120px !important;
        height: 120px !important;
        border-color: var(--sui-control-border-color) !important;
        border-radius: var(--sui-control-medium-border-radius);
        padding: 8px !important;

        &.no-thumbnail {
          display: flex;
          align-items: center;
          justify-content: center;
          background-color: var(--sui-secondary-background-color);

          .icon {
            font-size: 64px;
          }
        }
      }
    }

    & > div {
      flex: auto;
      overflow: hidden;

      .filename {
        margin: var(--sui-focus-ring-width);
        padding: 4px;
        word-break: break-all;

        &:empty {
          margin: 0;
          padding: 0;
        }
      }
    }
  }

  .empty {
    :global {
      button {
        flex-direction: column;
        justify-content: center;
        height: 120px;
        font-size: var(--sui-font-size-small);

        .icon {
          color: var(--sui-secondary-foreground-color);
          font-size: 48px;
        }

        &:disabled {
          pointer-events: none !important;

          * {
            opacity: 0.5;
          }
        }
      }

      &.invalid {
        button {
          border-color: var(--sui-error-border-color);
        }
      }
    }
  }
</style>
