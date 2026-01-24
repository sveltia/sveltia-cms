<script>
  import { Button, Icon } from '@sveltia/ui';
  import { isURL } from '@sveltia/utils/string';
  import { untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import { getAssetByPath } from '$lib/services/assets';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { getMediaKind } from '$lib/services/assets/kinds';
  import { entryDraft } from '$lib/services/contents/draft';
  import { createPath } from '$lib/services/utils/file';

  /**
   * @import { Asset, AssetKind, Entry } from '$lib/types/private';
   * @import { MediaField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} value The file value (URL, blob URL, or file path).
   * @property {string} fieldId The field ID for accessibility.
   * @property {MediaField} fieldConfig Field configuration.
   * @property {boolean} readonly Whether the field is readonly.
   * @property {boolean} invalid Whether the field is invalid.
   * @property {boolean} required Whether the field is required.
   * @property {string} collectionName The collection name.
   * @property {string | undefined} fileName The file name.
   * @property {Entry | undefined} entry The entry object.
   * @property {() => void} [onReplace] Event handler for replace action.
   * @property {() => void} [onRemove] Event handler for remove action.
   * @property {() => void} [onMoveUp] Event handler for move up action.
   * @property {() => void} [onMoveDown] Event handler for move down action.
   */

  /** @type {Props} */
  const {
    value,
    fieldId,
    fieldConfig,
    readonly = false,
    invalid = false,
    required = false,
    collectionName = '',
    fileName = undefined,
    entry = undefined,
    onReplace,
    onRemove,
    onMoveUp,
    onMoveDown,
  } = $props();

  /** @type {Asset | undefined} */
  let asset = $state();
  /** @type {File | undefined} */
  let file = $state();
  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();

  const { widget: fieldType } = $derived(fieldConfig);
  const isImageField = $derived(fieldType === 'image');

  /**
   * Get the path to display for the asset or file. For an unsaved file, this will be the same as
   * the final path in most cases, but it could be different if a file with the same name already
   * exists in the assets folder, and the new file is renamed to avoid conflicts.
   * @type {string} The path to display. If the folder could not be determined, it will only be the
   * file name.
   * @todo Handle template tags and relative paths if possible.
   */
  const fileDisplayPath = $derived.by(() => {
    if (!value) {
      return '';
    }

    if (file) {
      const { publicPath, entryRelative, hasTemplateTags } = $entryDraft?.files[value].folder ?? {};
      const _folder = entryRelative || hasTemplateTags ? '' : publicPath || '';

      return createPath([_folder, decodeURI(file.name.normalize())]);
    }

    if (!value.startsWith('blob:')) {
      const decodedValue = decodeURI(value);

      // Truncate query string for display. This is mainly for Unsplash URLs which have a long query
      // string for image parameters.
      if (isURL(decodedValue)) {
        const url = new URL(decodedValue);

        if (url.search) {
          url.search = '';
          return `${url}…`;
        }
      }

      return decodedValue;
    }

    return '';
  });

  /**
   * Update properties when value changes.
   */
  const updateProps = async () => {
    // Restore `file` after a draft backup is restored
    if (value?.startsWith('blob:') && $entryDraft) {
      file = $entryDraft.files[value]?.file;
    }

    // Update the `src` when an asset is selected
    if (value) {
      const getURLArgs = { value, entry, collectionName, fileName, fieldConfig };

      if (isImageField && /^https?:/.test(value)) {
        asset = undefined;
        kind = 'image';
        src = value;
      } else if (!value.startsWith('blob:')) {
        asset = getAssetByPath({ ...getURLArgs });
        kind = undefined;
        src = undefined;
      }

      if (!asset && !src) {
        kind = await getMediaKind(value);
        src = kind ? await getMediaFieldURL({ ...getURLArgs, thumbnail: true }) : undefined;
      }
    } else {
      // Remove properties after the value is removed
      asset = undefined;
      file = undefined;
      kind = undefined;
      src = undefined;
    }
  };

  $effect(() => {
    void [value];

    untrack(() => {
      updateProps();
    });
  });
</script>

<div role="none" class="filled">
  {#if (onMoveUp || onMoveDown) && !readonly}
    <!-- @todo Support drag & drop sorting -->
    <div role="toolbar" class="reorder-controls">
      <Button
        size="small"
        iconic
        disabled={!onMoveUp}
        aria-label={$_('move_up')}
        onclick={() => {
          onMoveUp?.();
        }}
      >
        {#snippet startIcon()}
          <Icon name="arrow_upward" />
        {/snippet}
      </Button>
      <Button
        size="small"
        iconic
        disabled={!onMoveDown}
        aria-label={$_('move_down')}
        onclick={() => {
          onMoveDown?.();
        }}
      >
        {#snippet startIcon()}
          <Icon name="arrow_downward" />
        {/snippet}
      </Button>
    </div>
  {/if}
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
    {#if typeof value === 'string'}
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
      {#if onReplace}
        <Button
          disabled={readonly}
          variant="tertiary"
          size="small"
          label={$_('replace')}
          aria-label={$_(`replace_${fieldType}`)}
          aria-controls="{fieldId}-value"
          onclick={() => {
            onReplace();
          }}
        />
      {/if}
      {#if onRemove}
        <Button
          disabled={readonly}
          variant="tertiary"
          size="small"
          label={$_('remove')}
          aria-label={$_(`remove_${fieldType}`)}
          aria-controls="{fieldId}-value"
          onclick={() => {
            onRemove();
          }}
        />
      {/if}
    </div>
  </div>
</div>

<style lang="scss">
  .filled {
    display: flex !important;
    align-items: center;
    gap: 12px;
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

  .reorder-controls {
    flex: none !important;
    display: flex;
    flex-direction: column;
    justify-content: space-evenly;
    align-items: center;
    gap: 4px;
    border: 1px solid var(--sui-control-border-color);
    border-radius: var(--sui-control-medium-border-radius);
    height: -moz-available;
    height: -webkit-fill-available;
    height: stretch;
    background-color: var(--sui-secondary-border-color);

    :global(button) {
      padding: 0;
      height: 16px;
    }
  }
</style>
