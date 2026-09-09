<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, Popup, Tree } from '@sveltia/ui';
  import { stripSlashes } from '@sveltia/utils/string';

  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import ParentFolderTreeItem from '$lib/components/contents/details/editor/parent-folder-tree-item.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { allEntries } from '$lib/services/contents';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import {
    getEntryDirPath,
    getMetaPathConfig,
    getSharedEntryFileName,
  } from '$lib/services/contents/collection/nested';
  import {
    findNestedTreeNode,
    getParentFolderTree,
  } from '$lib/services/contents/collection/nested/tree';
  import { entryDraft } from '$lib/services/contents/draft';
  import { createPath } from '$lib/services/utils/file';

  /**
   * @import { NestedTreeNode } from '$lib/services/contents/collection/nested/tree';
   * @import { InternalCollection, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  const collection = $derived(/** @type {InternalCollection} */ ($entryDraft?.collection));
  const config = $derived(collection ? getMetaPathConfig(collection) : undefined);
  const validity = $derived($entryDraft?.validities[locale]._path);
  const invalid = $derived(validity?.valid === false);

  /**
   * Name of the folder the entry occupies, which travels with it when the entry is filed elsewhere.
   * Only an entry that’s already saved in a collection where every entry shares one file name has
   * one: a new entry’s folder is named after its slug at save time, and in the other modes an entry
   * is a file rather than a folder.
   */
  const ownFolderName = $derived.by(() => {
    const subPath = $entryDraft?.originalEntry?.subPath;

    if ($entryDraft?.isNew || !subPath || !collection || !getSharedEntryFileName(collection)) {
      return undefined;
    }

    const dirPath = getEntryDirPath(subPath);

    return dirPath ? dirPath.slice(dirPath.lastIndexOf('/') + 1) : undefined;
  });

  const currentPath = $derived(stripSlashes($entryDraft?.currentPath ?? ''));
  /** Folder the entry is filed in, which is the parent of its own folder if it has one. */
  const selectedPath = $derived(ownFolderName ? getEntryDirPath(currentPath) : currentPath);

  const rootNode = $derived.by(() => {
    if (!collection) {
      return undefined;
    }

    // `$allEntries` is a key, because `getEntriesByCollection()` reads it indirectly
    void $allEntries;

    return /** @type {NestedTreeNode} */ ({
      path: '',
      label: getCollectionLabel(collection),
      children: getParentFolderTree({
        collection,
        entries: getEntriesByCollection(collection.name),
        // An entry can’t be filed within itself
        excludePath: ownFolderName
          ? getEntryDirPath($entryDraft?.originalEntry?.subPath ?? '')
          : undefined,
      }),
    });
  });

  const selectedLabel = $derived(
    (rootNode ? findNestedTreeNode([rootNode], selectedPath)?.label : undefined) ?? selectedPath,
  );

  /** @type {HTMLButtonElement | undefined} */
  let buttonElement = $state();
  let popupOpen = $state(false);

  /**
   * File the entry in the given folder. An entry that owns a folder keeps its name and takes
   * everything below it along.
   * @param {string} path Chosen folder path.
   */
  const selectPath = (path) => {
    if ($entryDraft) {
      $entryDraft.currentPath = ownFolderName ? createPath([path, ownFolderName]) : path;
    }

    // The popup closes itself for a menu item or an option, so a tree has to say when it’s done
    popupOpen = false;
  };
</script>

{#if $entryDraft && config}
  <FieldEditorGroup>
    <header role="none">
      <h4 role="none" id="{fieldId}-label">{_('entry_parent_folder')}</h4>
    </header>
    {#if invalid}
      <ValidationError id="{fieldId}-error">
        {#if validity?.patternMismatch}
          {_('edit_path_error.invalid')}
        {/if}
        {#if validity?.customError}
          {_('edit_path_error.recursive')}
        {/if}
        {#if validity?.duplicateError}
          {_('edit_path_error.duplicate')}
        {/if}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper">
      <Button
        bind:element={buttonElement}
        class="parent-folder-button"
        variant="tertiary"
        aria-haspopup="tree"
        aria-invalid={invalid}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
        aria-description={selectedPath || undefined}
      >
        {#snippet startIcon()}
          <Icon name={selectedPath ? 'folder' : 'bookmark_manager'} />
        {/snippet}
        {#snippet endIcon()}
          <Icon name="expand_more" />
        {/snippet}
        <span role="none" class="label">{selectedLabel}</span>
      </Button>
      <Popup bind:open={popupOpen} anchor={buttonElement} position="bottom-left">
        {#if rootNode}
          <!-- Choosing a folder closes the popup, so it has to be a deliberate action rather than
          something that happens while arrowing through the tree -->
          <Tree
            ariaLabel={_('entry_parent_folder')}
            class="parent-folder-tree"
            selectionFollowsFocus={false}
          >
            <ParentFolderTreeItem node={rootNode} {selectedPath} onSelectPath={selectPath} />
          </Tree>
        {/if}
      </Popup>
    </div>
  </FieldEditorGroup>
{/if}

<style>
  .field-wrapper {
    :global {
      /* Look like the `<Select>` trigger, which is a styled div rather than a button */
      .parent-folder-button {
        justify-content: flex-start;
        border-color: var(--sui-control-border-color);
        border-radius: var(--sui-textbox-border-radius);
        padding-inline: calc(var(--sui-textbox-height) / 4);
        width: calc(100% - var(--sui-focus-ring-width) * 2);
        height: var(--sui-textbox-height);
        color: var(--sui-control-foreground-color);
        background-color: var(--sui-disabled-background-color);
        font-family: var(--sui-control-font-family);
        font-size: var(--sui-control-font-size);
        font-weight: var(--sui-font-weight-normal, normal);
        line-height: var(--sui-control-line-height);

        &:is(:hover, :focus-visible, [aria-expanded='true']) {
          color: var(--sui-control-foreground-color);
          background-color: var(--sui-hover-background-color);
        }

        &[aria-invalid='true'] {
          border-color: var(--sui-error-border-color);
        }

        .icon {
          font-size: var(--sui-font-size-xx-large);
          opacity: 0.5;
        }

        .label {
          flex: auto;
          overflow: hidden;
          text-align: start;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }

      .parent-folder-tree {
        min-width: 240px;
        max-height: 50vh;
      }
    }
  }
</style>
