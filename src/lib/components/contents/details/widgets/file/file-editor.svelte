<!--
  @component
  Implement the editor for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import { AlertDialog, Button, ConfirmationDialog, Icon, TextArea } from '@sveltia/ui';
  import { getHash } from '@sveltia/utils/crypto';
  import DOMPurify from 'isomorphic-dompurify';
  import { flushSync } from 'svelte';
  import { _ } from 'svelte-i18n';
  import SelectAssetsDialog from '$lib/components/assets/browser/select-assets-dialog.svelte';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import DropZone from '$lib/components/assets/shared/drop-zone.svelte';
  import {
    allAssets,
    getAssetByPath,
    getAssetPublicURL,
    getMediaFieldURL,
    getMediaKind,
  } from '$lib/services/assets';
  import { getMediaLibraryConfig, transformFile } from '$lib/services/assets/media-library';
  import { entryDraft } from '$lib/services/contents/draft';
  import { hasMouse } from '$lib/services/user/env';
  import { formatSize } from '$lib/services/utils/file';

  /**
   * @import {
   * Asset,
   * AssetKind,
   * EntryDraft,
   * SelectedAsset,
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
    inEditorComponent = false,
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
    // Widget-specific options
    choose_url: canEnterURL = true,
  } = $derived(fieldConfig);
  const isImageWidget = $derived(widgetName === 'image');
  const { maxFileSize, fileTransformations } = $derived(getMediaLibraryConfig({ fieldConfig }));
  const collection = $derived($entryDraft?.collection);
  const entry = $derived($entryDraft?.originalEntry);

  /**
   * Reset the current selection.
   */
  const resetSelection = () => {
    dropZone?.reset();

    // This will reset `file`, `asset`, `kind` and `src` via `updateProps`
    currentValue = '';

    // Force running `updateProps` first, otherwise `file`, `asset`, etc. will be  `undefined` while
    // `await`ing a Promise in `onAssetSelect`
    flushSync();
  };

  /**
   * Handle selected asset.
   * @param {SelectedAsset} selectedAsset Selected asset details.
   */
  const onAssetSelect = async (selectedAsset) => {
    processing = true;
    resetSelection();

    ({ asset, file, url, credit } = selectedAsset);

    if (file) {
      const hash = await getHash(file);
      const existingAsset = $allAssets.find((a) => a.sha === hash);

      if (existingAsset) {
        // If the selected file has already been uploaded, use the existing asset instead of
        // uploading the same file twice
        asset = existingAsset;
        file = undefined;
      } else {
        if (fileTransformations) {
          file = await transformFile(file, fileTransformations);
        }

        if (file.size > maxFileSize) {
          showSizeLimitDialog = true;
        } else {
          // Set a temporary blob URL, which will be later replaced with the actual file path
          currentValue = URL.createObjectURL(file);
          // Cache the file itself for later upload
          /** @type {EntryDraft} */ ($entryDraft).files[currentValue] = file;
        }
      }
    }

    if (asset) {
      currentValue = getAssetPublicURL(asset, { pathOnly: true, allowSpecial: true, entry });
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
      file = $entryDraft.files[currentValue];
    }

    if (currentValue) {
      // Update the `src` when an asset is selected
      if (currentValue.startsWith('blob:')) {
        asset = undefined;
        kind = currentValue ? await getMediaKind(currentValue) : undefined;
        src =
          currentValue && kind
            ? await getMediaFieldURL(currentValue, entry, { thumbnail: true })
            : undefined;
      } else if (isImageWidget && /^https?:/.test(currentValue)) {
        asset = undefined;
        kind = 'image';
        src = currentValue;
      } else {
        asset = getAssetByPath(currentValue, { entry, collection });
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
  accept={isImageWidget ? 'image/*' : undefined}
  onSelect={({ files }) => {
    if (files.length) {
      onAssetSelect({ file: files[0] });
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
            {#if file}
              {decodeURI(file.name.normalize())}
            {:else if !currentValue.startsWith('blob:')}
              {decodeURI(currentValue)}
            {/if}
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
          {#if !inEditorComponent}
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
  {canEnterURL}
  {entry}
  bind:open={showSelectAssetsDialog}
  onSelect={({ asset: selectedAsset }) => {
    onAssetSelect(selectedAsset);
  }}
/>

<AlertDialog bind:open={showSizeLimitDialog} title={$_('assets_dialog.large_file.title')}>
  {$_('warning_oversized_file', { values: { size: formatSize(maxFileSize) } })}
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
        width: 160px !important;
        height: 160px !important;
        border-width: 1px;
        border-color: var(--sui-control-border-color);
        border-radius: var(--sui-control-medium-border-radius);

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
        height: 160px;

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
