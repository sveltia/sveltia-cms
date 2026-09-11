<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Dialog, Icon, Popup, TextInput, Tree } from '@sveltia/ui';
  import { stripSlashes } from '@sveltia/utils/string';

  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import ParentFolderTreeItem from '$lib/components/contents/details/editor/parent-folder-tree-item.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { getNewFolderName, validateNewFolderName } from '$lib/services/common/slug';
  import { allEntries } from '$lib/services/contents';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import {
    getEntryDirPath,
    getMetaPathConfig,
    getNestedConfig,
    getSharedEntryFileName,
  } from '$lib/services/contents/collection/nested';
  import { localizeDirPath } from '$lib/services/contents/collection/nested/i18n';
  import {
    addFolderToTree,
    findNestedTreeNode,
    getParentFolderTree,
  } from '$lib/services/contents/collection/nested/tree';
  import { entryDraft } from '$lib/services/contents/draft';
  import { createPath } from '$lib/services/utils/file';
  import { mergeUnpublishedEntries, unpublishedEntries } from '$lib/services/workflow';

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
   * Whether this pane is the one that decides where the entry goes. The folder is chosen once, in
   * the default locale’s pane, and the others show it without offering to change it. With localized
   * slugs the folders go by localized names, so the other panes show the folder as it’s named in
   * their own locale.
   * @see https://github.com/sveltia/sveltia-cms/issues/962
   */
  const isDefaultLocale = $derived(locale === collection?._i18n.defaultLocale);

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

  /**
   * Whether a folder can be created with the picker. In the `subfolders` mode a folder is an entry,
   * so the tree grows as entries are created; otherwise entries are files, which never make a
   * folder, leaving this as the only way to add one.
   */
  const canCreateFolder = $derived(
    !!collection && getNestedConfig(collection)?.subfolders === false,
  );

  let newFolderDialogOpen = $state(false);
  let newFolderName = $state('');
  /**
   * Whether the folder name has been typed in yet. An empty name is only reported once the field
   * has been used, so the dialog doesn’t open with an error against a field nobody has touched.
   */
  let newFolderNameEdited = $state(false);
  /**
   * Folders created with the picker but not yet stored, because a folder only appears in the
   * repository once an entry is saved in it.
   * @type {string[]}
   */
  let newFolderPaths = $state([]);

  const rootNode = $derived.by(() => {
    if (!collection) {
      return undefined;
    }

    // `$allEntries` is a key, because `getEntriesByCollection()` reads it indirectly, while
    // `$unpublishedEntries` is tracked as a normal dependency
    void $allEntries;

    const { name } = collection;

    // With Editorial Workflow a section can be started and filled in one sitting: a page that only
    // exists as a draft has to be offered as a parent too, or its sub-pages couldn’t be filed under
    // it until it’s published. A pending move is reflected the same way, so the tree shows the
    // folders as they’ll be once the drafts land
    const entries = mergeUnpublishedEntries(
      getEntriesByCollection(name),
      $unpublishedEntries.filter(({ workflow }) => workflow.collectionName === name),
    );

    return /** @type {NestedTreeNode} */ ({
      path: '',
      label: getCollectionLabel(collection),
      children: newFolderPaths.reduce(
        (nodes, path) => addFolderToTree({ nodes, path }),
        getParentFolderTree({
          collection,
          entries,
          // An entry can’t be filed within itself
          excludePath: ownFolderName
            ? getEntryDirPath($entryDraft?.originalEntry?.subPath ?? '')
            : undefined,
          // Each pane names the folders in its own language
          locale,
        }),
      ),
    });
  });

  /**
   * Folder path as it is in this pane’s locale. The tree is keyed by the default locale’s paths,
   * which is how the entry is identified, but a localized file is stored below the localized
   * folder chain, so that’s what this pane describes the choice with.
   */
  const localizedSelectedPath = $derived.by(() => {
    if (!collection || isDefaultLocale) {
      return selectedPath;
    }

    // `$allEntries` is a key, the same way it is for the tree
    void $allEntries;

    return localizeDirPath({ collection, dirPath: selectedPath, locale });
  });

  const selectedLabel = $derived(
    (rootNode ? findNestedTreeNode([rootNode], selectedPath)?.label : undefined) ??
      localizedSelectedPath,
  );

  /** @type {HTMLButtonElement | undefined} */
  let buttonElement = $state();
  let popupOpen = $state(false);
  /** Names of the folders already in the folder the new one would be created in. */
  const takenFolderNames = $derived(
    ((rootNode ? findNestedTreeNode([rootNode], selectedPath)?.children : undefined) ?? []).map(
      ({ path }) => path.slice(path.lastIndexOf('/') + 1),
    ),
  );

  const newFolderError = $derived(
    validateNewFolderName({ takenNames: takenFolderNames, name: newFolderName }),
  );

  const showNewFolderError = $derived(newFolderNameEdited && !!newFolderError);
  /**
   * Whether there’s a folder to choose. A collection whose entries all sit at the top level has
   * nothing below the collection folder, leaving the picker with a single item and nothing to do.
   */
  const hasFolderChoice = $derived(!!rootNode?.children.length);

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

<!-- A collection whose entries all sit at the top level has no folder to choose and, in the
`subfolders` mode, no way to make one, which leaves nothing for the field to do -->
{#if $entryDraft && config && (hasFolderChoice || canCreateFolder)}
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
        disabled={!hasFolderChoice || !isDefaultLocale}
        aria-haspopup="tree"
        aria-invalid={invalid}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
        aria-description={localizedSelectedPath || undefined}
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
      {#if canCreateFolder}
        <!-- A folder that holds no entry can’t be in the tree, so it has to be created here. It
        sits outside the picker, which is disabled when there’s nothing in the tree to choose -->
        <Button
          variant="ghost"
          iconic
          class="new-parent-folder-button"
          disabled={!isDefaultLocale}
          aria-label={_('new_parent_folder')}
          onclick={() => {
            newFolderName = '';
            newFolderNameEdited = false;
            newFolderDialogOpen = true;
          }}
        >
          {#snippet startIcon()}
            <Icon name="create_new_folder" />
          {/snippet}
        </Button>
      {/if}
    </div>
  </FieldEditorGroup>
  <Dialog
    bind:open={newFolderDialogOpen}
    title={_('new_parent_folder')}
    okLabel={_('new_parent_folder_create')}
    okDisabled={!!newFolderError}
    onOk={() => {
      const path = createPath([selectedPath, getNewFolderName(newFolderName)]);

      newFolderPaths = [...newFolderPaths, path];
      selectPath(path);
    }}
  >
    <div role="none" class="new-parent-folder">
      <div role="none">
        <TextInput
          dir="auto"
          flex
          aria-label={_('new_parent_folder_name')}
          aria-errormessage="{fieldId}-new-folder-error"
          invalid={showNewFolderError}
          bind:value={newFolderName}
          oninput={() => {
            newFolderNameEdited = true;
          }}
        />
        {#if showNewFolderError}
          <ValidationError id="{fieldId}-new-folder-error">
            {_(`new_parent_folder_error.${newFolderError}`)}
          </ValidationError>
        {/if}
      </div>
      <p role="none">
        {_('new_parent_folder_description', {
          values: { folder: selectedLabel },
        })}
      </p>
    </div>
  </Dialog>
{/if}

<style>
  .field-wrapper {
    display: flex;
    align-items: center;

    :global {
      /* Look like the `<Select>` trigger, which is a styled div rather than a button */
      .parent-folder-button {
        justify-content: flex-start;
        border-color: var(--sui-control-border-color);
        border-radius: var(--sui-textbox-border-radius);
        padding-inline: calc(var(--sui-textbox-height) / 4);
        flex: auto;
        min-width: 0;
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

      /* Stand beside the picker without stretching, so the folder name gets the room */
      .new-parent-folder-button {
        flex: none;
        height: var(--sui-textbox-height);
        white-space: nowrap;
      }
    }
  }

  .new-parent-folder {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 320px;

    p {
      margin: 0;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
    }
  }
</style>
