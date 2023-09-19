<!--
  @component
  Implement the editor for the File and Image widgets.
  @see https://decapcms.org/docs/widgets/#file
  @see https://decapcms.org/docs/widgets/#image
-->
<script>
  import { Button, Dialog, TextArea } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import SelectAssetsDialog from '$lib/components/assets/shared/select-assets-dialog.svelte';
  import Image from '$lib/components/common/image.svelte';
  import { getAssetURL, getMediaFieldURL } from '$lib/services/assets';
  import { entryDraft } from '$lib/services/contents/editor';
  import { formatSize, getDataURL } from '$lib/services/utils/files';

  export let locale = '';

  export let keyPath = '';

  /**
   * @type {FileField}
   */
  export let fieldConfig = undefined;

  /**
   * @type {string}
   */
  export let currentValue = undefined;

  /**
   * @type {boolean}
   */
  export let disabled = false;

  /**
   * @type {Asset}
   */
  let asset = undefined;
  /**
   * @type {File}
   */
  let file = undefined;
  /**
   * @type {string}
   */
  let url = undefined;
  /**
   * @type {string}
   */
  let credit = undefined;
  let showSelectAssetsDialog = false;
  let showSizeLimitDialog = false;
  let showPhotoCreditDialog = false;
  let photoCredit = '';

  $: ({
    widget,
    // Widget-specific options
    choose_url: canEnterURL = true,
    media_library: { config: { max_file_size: maxFileSize = undefined } = {} } = {},
  } = fieldConfig);
  $: isImageWidget = widget === 'image';

  /**
   * Handle selected asset.
   * @param {SelectedAsset} selectedAsset Selected asset details.
   */
  const onAssetSelect = async (selectedAsset) => {
    ({ asset, file, url, credit } = selectedAsset);

    if (asset) {
      currentValue = await getAssetURL(asset, { pathOnly: true });
    }

    if (file) {
      // Check the max file size
      // @see https://decapcms.org/docs/beta-features/#image-widget-file-size-limit
      if (isImageWidget && Number.isInteger(maxFileSize) && file.size > maxFileSize) {
        showSizeLimitDialog = true;
      } else {
        // Use the `data:` URL temporally, and replace it later; avoid `blob:` here because it will
        // be unavailable event after Vite HMR
        currentValue = await getDataURL(file);
        // Cache the file itself for later upload
        $entryDraft.files[locale][keyPath] = file;
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
</script>

<div class="image-widget">
  {#if isImageWidget && currentValue}
    {#await getMediaFieldURL(currentValue, $entryDraft.originalEntry) then src}
      <Image {src} checkerboard={true} />
    {/await}
  {/if}
  <div>
    {#if typeof currentValue === 'string'}
      <div class="filename">
        {#if file}
          {file.name}
        {:else if !currentValue.startsWith('data:')}
          {currentValue}
        {/if}
      </div>
    {/if}
    <div>
      <Button
        {disabled}
        class="tertiary small"
        label={currentValue ? $_('replace') : $_('add')}
        on:click={() => {
          showSelectAssetsDialog = true;
        }}
      />
      {#if currentValue}
        <Button
          {disabled}
          class="tertiary small"
          label={$_('remove')}
          on:click={() => {
            currentValue = '';
            asset = undefined;
            file = undefined;
            url = undefined;
            credit = undefined;
          }}
        />
      {/if}
    </div>
  </div>
</div>

<SelectAssetsDialog
  kind={isImageWidget ? 'image' : 'any'}
  {canEnterURL}
  bind:open={showSelectAssetsDialog}
  on:select={({ detail }) => {
    onAssetSelect(detail);
  }}
/>

<Dialog
  bind:open={showSizeLimitDialog}
  title={$_('assets_dialog.large_file.title')}
  showCancel={false}
>
  {$_('assets_dialog.large_file.description', { values: { size: formatSize(maxFileSize) } })}
</Dialog>

<Dialog
  bind:open={showPhotoCreditDialog}
  title={$_('assets_dialog.photo_credit.title')}
  okLabel={$_('copy')}
  on:ok={() => {
    navigator.clipboard.writeText(photoCredit);
  }}
>
  <div>{$_('assets_dialog.photo_credit.description')}</div>
  <div>
    <TextArea
      readonly="readonly"
      value={photoCredit}
      on:click={(event) => {
        /** @type {HTMLTextAreaElement} */ (event.target).focus();
        /** @type {HTMLTextAreaElement} */ (event.target).select();
      }}
    />
  </div>
</Dialog>

<style lang="scss">
  .image-widget {
    display: flex !important;
    align-items: center;
    gap: 16px;

    :global(.checkerboard) {
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

      & > div:not(:last-child) {
        margin: 0 0 8px;
      }

      .filename {
        word-break: break-all;
      }
    }
  }
</style>
