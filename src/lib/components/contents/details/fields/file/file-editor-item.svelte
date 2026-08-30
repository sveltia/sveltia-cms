<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, TextInput } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';
  import { isURL } from '@sveltia/utils/string';
  import { tick, untrack } from 'svelte';

  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import FileExtensionChangeDialog from '$lib/components/assets/shared/file-extension-change-dialog.svelte';
  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import { getAssetByPath } from '$lib/services/assets';
  import { getMediaFieldURL } from '$lib/services/assets/info';
  import { getMediaKind } from '$lib/services/assets/kinds';
  import { entryDraft } from '$lib/services/contents/draft';
  import { activeInlineEditors } from '$lib/services/contents/editor';
  import { getUnsavedFileDisplayPath } from '$lib/services/contents/fields/file/helpers';
  import { formatFileName, isEquivalentFileExtension } from '$lib/services/utils/file';

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
   * @property {string} [typedKeyPath] Field key path for field-level media folders.
   * @property {string} [componentName] Custom editor component name for a field-level asset folder.
   * @property {Entry | undefined} entry The entry object.
   * @property {() => void} [onReplace] Event handler for replace action.
   * @property {() => void} [onRemove] Event handler for remove action.
   * @property {number} [index] Index of the item within a multi-value field.
   * @property {number} [itemCount] Total number of items in a multi-value field.
   * @property {boolean} [dragging] Whether this item is currently being dragged.
   * @property {() => void} [onDragStart] Event handler for the start of a reorder drag.
   * @property {() => void} [onDragEnd] Event handler for the end of a reorder drag.
   * @property {(index: number, action: string) => void} [onMove] Event handler for a reorder
   * shortcut or button, called with the destination index and the `data-action` of the activated
   * control. Reordering is only offered when this is given.
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
    typedKeyPath = undefined,
    componentName = undefined,
    entry = undefined,
    onReplace,
    onRemove,
    index = 0,
    itemCount = 1,
    dragging = false,
    onDragStart,
    onDragEnd,
    onMove,
  } = $props();

  /** @type {Asset | undefined} */
  let asset = $state();
  /** @type {File | undefined} */
  let file = $state();
  /** @type {AssetKind | undefined} */
  let kind = $state();
  /** @type {string | undefined} */
  let src = $state();
  /** Whether the file name is being edited. */
  let editing = $state(false);
  /** File name being edited. */
  let newName = $state('');
  /** @type {HTMLInputElement | undefined} */
  let inputElement = $state();
  let showExtensionChangeDialog = $state(false);
  /**
   * Whether the drag handle has been pressed, making this item draggable. Only the handle starts a
   * drag, so the file name and path stay selectable.
   */
  let grabbed = $state(false);

  const { widget: fieldType } = $derived(fieldConfig);
  const isImageField = $derived(fieldType === 'image');
  const sortable = $derived(!!onMove && !readonly);
  /**
   * Whether the file is not yet saved to the repository. An unsaved file is a pending upload cached
   * in the draft and referenced with a temporary blob URL, so it can still be renamed.
   */
  const unsaved = $derived(!!file && !!value?.startsWith('blob:'));
  const canRename = $derived(unsaved && !readonly);
  const oldExtension = $derived(file ? getPathInfo(file.name).extension : undefined);
  /** Sanitized file name to be saved, which may be different from the entered name. */
  const finalName = $derived(formatFileName(newName.trim()));
  const newExtension = $derived(getPathInfo(finalName).extension);

  const getURLArgs = $derived({
    value,
    entry,
    collectionName,
    fileName,
    componentName,
    typedKeyPath,
    fieldConfig,
  });

  /**
   * Get the path to display for the asset or file. For an unsaved file, this is the public path
   * where the file will be stored, with any template tags like `{{slug}}` and entry-relative paths
   * resolved with the current draft content. It will be the same as the final path in most cases,
   * but it could be different if a file with the same name already exists in the assets folder, and
   * the new file is renamed to avoid conflicts, or if the entry slug changes before saving.
   * @type {string} The path to display. If the folder could not be determined, it will only be the
   * file name.
   */
  const fileDisplayPath = $derived.by(() => {
    if (!value) {
      return '';
    }

    if (file) {
      const name = decodeURI(file.name.normalize());

      return $entryDraft
        ? getUnsavedFileDisplayPath({ draft: $entryDraft, blobURL: value, fileName: name })
        : name;
    }

    if (!value.startsWith('blob:')) {
      const decodedValue = decodeURI(value);

      // Truncate query string for display. This is mainly for Unsplash URLs which have a long query
      // string for image parameters.
      if (isURL(decodedValue)) {
        // eslint-disable-next-line svelte/prefer-svelte-reactivity
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
   * Start editing the file name. The input field is focused, and the file name is selected,
   * excluding the extension, just like the macOS Finder and Windows File Explorer do.
   */
  const startEditing = async () => {
    if (!file) {
      return;
    }

    newName = file.name;
    editing = true;
    await tick();
    inputElement?.focus();
    inputElement?.setSelectionRange(0, getPathInfo(newName).filename.length);
  };

  /**
   * Rename the unsaved file by replacing the cached `File` object with a new one. The blob URL,
   * which is the current field value, remains the same, so no other references have to be updated.
   */
  const renameFile = () => {
    if (!file || !$entryDraft?.files[value]) {
      return;
    }

    const newFile = new File([file], finalName, {
      type: file.type,
      lastModified: file.lastModified,
    });

    $entryDraft.files[value].file = newFile;
    file = newFile;
    editing = false;
  };

  /**
   * Apply the entered file name. If the file extension is being changed, ask for confirmation
   * first, because a mismatched extension could make the file unusable.
   */
  const applyNewName = () => {
    if (!file || !finalName || finalName === file.name) {
      editing = false;
      return;
    }

    if (isEquivalentFileExtension(oldExtension, newExtension)) {
      renameFile();
    } else {
      showExtensionChangeDialog = true;
    }
  };

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

  $effect(() => {
    if (!editing) {
      return undefined;
    }

    // Let the Escape key cancel the editing instead of closing the entry editor
    activeInlineEditors.update((count) => count + 1);

    return () => {
      activeInlineEditors.update((count) => count - 1);
    };
  });
</script>

<div
  role="none"
  class="filled"
  class:sortable
  class:dragging
  draggable={grabbed}
  ondragstart={(/** @type {DragEvent} */ event) => {
    onDragStart?.();

    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = 'move';
      // Firefox doesn’t start a drag unless some data is attached to it
      event.dataTransfer.setData('text/plain', fileDisplayPath);
    }
  }}
  ondragend={() => {
    grabbed = false;
    onDragEnd?.();
  }}
>
  {#if sortable}
    <div role="none" class="reorder-controls">
      <ReorderControls
        {index}
        {itemCount}
        disabled={itemCount < 2}
        onGrab={() => {
          grabbed = true;
        }}
        onRelease={() => {
          grabbed = false;
        }}
        {onMove}
      />
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
      <div role="none" class="path">
        {#if editing}
          <TextInput
            id="{fieldId}-value"
            dir="auto"
            flex
            bind:value={newName}
            bind:element={inputElement}
            {invalid}
            {required}
            aria-labelledby="{fieldId}-label"
            aria-errormessage="{fieldId}-error"
            onkeydown={(/** @type {KeyboardEvent} */ event) => {
              const { key, isComposing } = event;

              // Ignore the Enter key while the user is typing with an IME
              if (isComposing || !(key === 'Enter' || key === 'Escape')) {
                return;
              }

              event.preventDefault();
              event.stopPropagation();

              if (key === 'Enter') {
                applyNewName();
              } else {
                editing = false;
              }
            }}
          />
          <Button
            size="small"
            iconic
            disabled={!finalName}
            aria-label={_('done')}
            aria-controls="{fieldId}-value"
            onclick={() => {
              applyNewName();
            }}
          >
            {#snippet startIcon()}
              <Icon name="check" />
            {/snippet}
          </Button>
          <Button
            size="small"
            iconic
            aria-label={_('cancel')}
            aria-controls="{fieldId}-value"
            onclick={() => {
              editing = false;
            }}
          >
            {#snippet startIcon()}
              <Icon name="close" />
            {/snippet}
          </Button>
        {:else}
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
          {#if canRename}
            <Button
              size="small"
              iconic
              aria-label={_('rename')}
              aria-controls="{fieldId}-value"
              onclick={() => {
                startEditing();
              }}
            >
              {#snippet startIcon()}
                <Icon name="edit" />
              {/snippet}
            </Button>
          {/if}
        {/if}
      </div>
    {/if}
    <div role="none">
      {#if onReplace}
        <Button
          disabled={readonly}
          variant="tertiary"
          size="small"
          label={_('replace')}
          aria-label={_(`replace_${fieldType}`)}
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
          label={_('remove')}
          aria-label={_(`remove_${fieldType}`)}
          aria-controls="{fieldId}-value"
          onclick={() => {
            onRemove();
          }}
        />
      {/if}
    </div>
  </div>
</div>

<FileExtensionChangeDialog
  bind:open={showExtensionChangeDialog}
  {oldExtension}
  {newExtension}
  okLabel={_('rename')}
  onOk={() => {
    renameFile();
  }}
  onCancel={() => {
    // Go back to the input field, keeping the entered name
    inputElement?.focus();
  }}
/>

<style>
  .filled {
    display: flex !important;
    align-items: center;
    position: relative;
    gap: 12px;
    margin: var(--sui-focus-ring-width);
    background-color: var(--sui-primary-background-color); /* for dragging opacity */

    /* The dragged item is left as a faint placeholder marking the gap it would drop into. The
      pointer already carries the browser’s own drag image of it, so showing it twice at full
      strength would just be confusing. */

    &.dragging {
      opacity: 0.25;
    }

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

      .sui.button.tertiary.small {
        margin: var(--sui-focus-ring-width);
      }
    }

    & > div {
      flex: auto;
      overflow: hidden;

      .path {
        display: flex;
        align-items: center;
        gap: 4px;

        @media (width < 768px) {
          font-size: var(--sui-font-size-small);
        }

        .filename {
          flex: auto;
        }
      }

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

    &.sortable {
      gap: 0;
      border-width: 1px;
      border-style: solid;
      border-color: var(--sui-control-border-color) !important;
      border-radius: var(--sui-control-medium-border-radius);

      :global {
        .preview {
          margin-inline-end: 12px;
          border-radius: 0;
          border-width: 0 1px 0 0;
        }
      }
    }
  }

  .reorder-controls {
    flex: none !important;
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    gap: 4px;
    width: 28px;
    height: -moz-available;
    height: -webkit-fill-available;
    height: stretch;
    background-color: var(--sui-secondary-border-color);
  }
</style>
