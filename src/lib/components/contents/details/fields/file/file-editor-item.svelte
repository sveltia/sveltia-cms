<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';
  import { getPathInfo } from '@sveltia/utils/file';

  import AssetPreview from '$lib/components/assets/shared/asset-preview.svelte';
  import FileExtensionChangeDialog from '$lib/components/assets/shared/file-extension-change-dialog.svelte';
  import EditableText from '$lib/components/common/editable-text.svelte';
  import ReorderControls from '$lib/components/common/reorder-controls.svelte';
  import { getAssetByPath } from '$lib/services/assets';
  import { formatFileName } from '$lib/services/assets/file-name';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    getFileDisplayPath,
    getUnsavedFileName,
  } from '$lib/services/contents/fields/file/helpers';
  import { getMediaFieldPreview } from '$lib/services/contents/fields/file/preview';
  import { getDefaultMediaLibraryOptions } from '$lib/services/integrations/media-libraries/default';
  import { isEquivalentFileExtension } from '$lib/services/utils/file';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { Asset, AssetKind, Entry, EntryDraft } from '$lib/types/private';
   * @import { FileField, MediaField } from '$lib/types/public';
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

  const entryDraft = getEntryDraftContext();

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
  /** Whether the value is a folder path, with the File field’s `select_folder` option. */
  const isFolder = $derived(
    fieldType === 'file' && /** @type {FileField} */ (fieldConfig).select_folder === true,
  );
  const sortable = $derived(!!onMove && !readonly);
  /**
   * Whether the file is not yet saved to the repository. An unsaved file is a pending upload cached
   * in the draft and referenced with a temporary blob URL, so it can still be renamed.
   */
  const unsaved = $derived(!!file && !!value?.startsWith('blob:'));
  const canRename = $derived(unsaved && !readonly);
  /**
   * Name the unsaved file will be saved with, which is filled with the current draft content if the
   * `filename_template` media library option applies to the file.
   */
  const unsavedFileName = $derived(
    file
      ? /** @type {string} */ (
          getUnsavedFileName({
            draft: /** @type {EntryDraft} */ (entryDraft.current),
            blobURL: value,
          })
        )
      : undefined,
  );
  const oldExtension = $derived(file ? getPathInfo(file.name).extension : undefined);
  /**
   * Sanitized, and possibly slugified, file name to be saved, which may be different from the
   * entered name.
   */
  const finalName = $derived.by(() => {
    const name = newName.trim();

    // An empty name has nothing to slugify
    return name
      ? formatFileName(name, {
          slugificationEnabled: getDefaultMediaLibraryOptions({ fieldConfig }).config
            .slugify_filename,
        })
      : '';
  });
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
   * Path to display for the asset or file. For an unsaved file, this is the public path where the
   * file will be stored.
   */
  const fileDisplayPath = $derived(
    getFileDisplayPath({
      draft: /** @type {EntryDraft} */ (entryDraft.current),
      value,
      unsavedFileName,
    }),
  );

  /**
   * Rename the unsaved file by replacing the cached `File` object with a new one. The blob URL,
   * which is the current field value, remains the same, so no other references have to be updated.
   */
  const renameFile = () => {
    /* v8 ignore next 3 -- the file is held in the draft as long as it’s shown here */
    if (!file || !entryDraft.current?.files[value]) {
      return;
    }

    const newFile = new File([file], finalName, {
      type: file.type,
      lastModified: file.lastModified,
    });

    entryDraft.current.files[value].file = newFile;
    // The name is set by hand, so the file name template no longer applies
    delete entryDraft.current.files[value].nameTemplate;
    file = newFile;
    editing = false;
  };

  /**
   * Apply the entered file name. If the file extension is being changed, ask for confirmation
   * first, because a mismatched extension could make the file unusable.
   * @returns {boolean} Whether the editing ends, which it doesn’t while waiting for the
   * confirmation.
   */
  const applyNewName = () => {
    if (!file || !finalName || finalName === unsavedFileName) {
      return true;
    }

    if (isEquivalentFileExtension(oldExtension, newExtension)) {
      renameFile();

      return true;
    }

    // Keep editing until the change is confirmed
    showExtensionChangeDialog = true;

    return false;
  };

  /**
   * Update properties when value changes.
   * @param {() => boolean} isStale Function telling whether the value has changed since, so the
   * result of a slow lookup for an earlier value doesn’t replace the preview of the current one.
   */
  const updateProps = async (isStale) => {
    // Restore `file` after a draft backup is restored, and drop it once the value is no longer an
    // unsaved file, e.g. after the changes are reverted, so its name isn’t shown for another value
    file = value?.startsWith('blob:') ? entryDraft.current?.files[value]?.file : undefined;

    // Remove the preview of the previous value, so it’s not shown for another one, e.g. a saved
    // asset or an unsaved file replaced with another unsaved file
    asset = undefined;
    kind = undefined;
    src = undefined;

    // A folder has no preview, nor has an empty value
    if (isFolder || !value) {
      return;
    }

    if (isImageField && /^https?:/.test(value)) {
      kind = 'image';
      src = value;

      return;
    }

    // Update the `src` when an asset is selected
    if (!value.startsWith('blob:')) {
      asset = getAssetByPath({ ...getURLArgs });
    }

    if (!asset) {
      // Take the arguments before waiting, as the value may have changed by then
      const preview = await getMediaFieldPreview({ ...getURLArgs, thumbnail: true });

      if (!isStale()) {
        ({ kind, src } = preview);
      }
    }
  };

  watch(
    () => value,
    () => {
      let stale = false;

      updateProps(() => stale);

      return () => {
        stale = true;
      };
    },
  );
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
      <Icon name={isFolder ? 'folder' : 'draft'} />
    </span>
  {/if}
  <div role="none">
    <div role="none" class="path">
      <EditableText
        id="{fieldId}-value"
        value={fileDisplayPath}
        initialText={unsavedFileName}
        bind:editing
        bind:text={newName}
        bind:inputElement
        canEdit={canRename}
        editLabel={_('rename')}
        {readonly}
        {invalid}
        {required}
        applyDisabled={!finalName}
        dir="ltr"
        ariaLabelledby="{fieldId}-label"
        ariaErrormessage="{fieldId}-error"
        getSelectionEnd={(name) => getPathInfo(name).filename.length}
        onApply={applyNewName}
      />
    </div>
    {#if editing && finalName !== newName.trim()}
      <div role="status" class="note">
        {_('file_will_be_saved_as', { values: { name: finalName } })}
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

      .note {
        margin: 4px 0;
        color: var(--sui-secondary-foreground-color);
        font-size: var(--sui-font-size-small);
      }

      .path {
        @media (width < 768px) {
          font-size: var(--sui-font-size-small);
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
