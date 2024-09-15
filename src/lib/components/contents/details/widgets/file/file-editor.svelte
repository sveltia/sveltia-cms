<!--
  @component
  Implement the editor for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import { AlertDialog, Button, ConfirmationDialog, TextArea } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import SelectAssetsDialog from '$lib/components/assets/shared/select-assets-dialog.svelte';
  import {
    getAssetByPath,
    getAssetPublicURL,
    getMediaFieldURL,
    getMediaKind,
  } from '$lib/services/assets';
  import { entryDraft } from '$lib/services/contents/draft';
  import { formatSize } from '$lib/services/utils/file';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {FileField}
   */
  export let fieldConfig;
  /**
   * @type {string | undefined}
   */
  export let currentValue;
  /**
   * @type {boolean}
   */
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  export let invalid = false;

  /**
   * @type {Asset | undefined}
   */
  let asset;
  /**
   * @type {File | undefined}
   */
  let file;
  /**
   * @type {string | undefined}
   */
  let url;
  /**
   * @type {AssetKind | undefined}
   */
  let kind;
  /**
   * @type {string | undefined}
   */
  let src;
  /**
   * @type {string | undefined}
   */
  let credit;
  let showSelectAssetsDialog = false;
  let showSizeLimitDialog = false;
  let showPhotoCreditDialog = false;
  let photoCredit = '';

  $: ({
    widget: widgetName,
    // Widget-specific options
    choose_url: canEnterURL = true,
    media_library: {
      config: { max_file_size: maxFileSize = /** @type {number | undefined} */ (undefined) } = {},
    } = {},
  } = fieldConfig);
  $: isImageWidget = widgetName === 'image';
  $: entry = $entryDraft?.originalEntry;

  /**
   * Reset the current selection.
   */
  const resetSelection = () => {
    currentValue = '';
    asset = undefined;
    file = undefined;
    url = undefined;
    credit = undefined;
  };

  /**
   * Handle selected asset.
   * @param {SelectedAsset} selectedAsset - Selected asset details.
   */
  const onAssetSelect = async (selectedAsset) => {
    resetSelection();

    ({ asset, file, url, credit } = selectedAsset);

    if (asset) {
      currentValue = getAssetPublicURL(asset, { pathOnly: true, allowSpecial: true, entry });
    }

    if (file) {
      // Check the max file size
      // @see https://decapcms.org/docs/widgets/#image
      if (
        isImageWidget &&
        maxFileSize !== undefined &&
        Number.isInteger(maxFileSize) &&
        file.size > maxFileSize
      ) {
        showSizeLimitDialog = true;
      } else {
        // Set a temporary blob URL, which will be later replaced with the actual file path
        currentValue = URL.createObjectURL(file);
        // Cache the file itself for later upload
        /** @type {EntryDraft} */ ($entryDraft).files[locale][keyPath] = file;
      }
    }

    if (url) {
      currentValue = url;
    }

    if (credit) {
      photoCredit = DOMPurify.sanitize(credit, { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href'] });
      showPhotoCreditDialog = true;
    }
  };

  /**
   * Update a couple of properties when {@link currentValue} is updated.
   */
  const updateProps = async () => {
    // Restore `file` after a draft backup is restored
    if (currentValue?.startsWith('blob:') && $entryDraft) {
      file = $entryDraft.files[locale][keyPath];
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
      } else {
        asset = getAssetByPath(currentValue, entry);
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

  $: {
    void currentValue;
    updateProps();
  }
</script>

<div role="none" class="image-widget">
  {#if kind && src}
    <AssetPreview {kind} {src} variant="tile" checkerboard={true} />
  {:else if asset}
    <AssetPreview kind={asset.kind} {asset} variant="tile" checkerboard={true} />
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
          {file.name.normalize()}
        {:else if !currentValue.startsWith('blob:')}
          {currentValue}
        {/if}
      </div>
    {/if}
    <div role="none">
      <Button
        disabled={readonly}
        variant="tertiary"
        label={currentValue ? $_('replace') : $_('select')}
        aria-label={currentValue ? $_(`replace_${widgetName}`) : $_(`select_${widgetName}`)}
        aria-controls="{fieldId}-value"
        onclick={() => {
          showSelectAssetsDialog = true;
        }}
      />
      {#if currentValue}
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

<SelectAssetsDialog
  kind={isImageWidget ? 'image' : undefined}
  {canEnterURL}
  {entry}
  bind:open={showSelectAssetsDialog}
  on:select={({ detail }) => {
    onAssetSelect(detail);
  }}
/>

<AlertDialog bind:open={showSizeLimitDialog} title={$_('assets_dialog.large_file.title')}>
  {$_('assets_dialog.large_file.description', {
    values: { size: formatSize(/** @type {number} */ (maxFileSize)) },
  })}
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
  .image-widget {
    display: flex !important;
    align-items: center;
    gap: 16px;

    :global(.preview) {
      flex: none;
      width: 160px !important;
      height: 160px !important;
      border-width: 1px;
      border-color: var(--sui-control-border-color);
      border-radius: var(--sui-control-medium-border-radius);
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
</style>
