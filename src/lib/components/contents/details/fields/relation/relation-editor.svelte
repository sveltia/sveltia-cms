<!--
  @component
  Implement the editor for a Relation field.
  @see https://decapcms.org/docs/widgets/#Relation
  @see https://sveltiacms.app/en/docs/fields/relation
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, Icon, Menu, MenuButton, MenuItem } from '@sveltia/ui';

  import QuickAddDialog from '$lib/components/contents/details/fields/relation/quick-add-dialog.svelte';
  import SelectEditor from '$lib/components/contents/details/fields/select/select-editor.svelte';
  import { getCollection, getCollectionLabel } from '$lib/services/contents/collection';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getEditorEntryValues } from '$lib/services/contents/editor/entry-values';
  import { getFieldEditorContext } from '$lib/services/contents/editor/field-context';
  import { getOptions } from '$lib/services/contents/fields/relation/helpers';
  import {
    getCreatableCollection,
    getEditableEntries,
    getRefEntriesWithPending,
    getUnlistedEntries,
    hasCreationRoom,
    replaceEntryValues,
    selectPendingEntry,
  } from '$lib/services/contents/fields/relation/quick-add';

  /**
   * @import { Entry, FieldEditorProps, InternalEntryCollection } from '$lib/types/private';
   * @import { RelationField, SelectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  const { valueStoreKey = 'currentValues' } = getFieldEditorContext();
  // The entry the field belongs to: the draft, or the row in the bulk editor, which has no draft
  const editorEntry = getEditorEntryValues();

  /** @type {FieldEditorProps & Props} */
  let {
    locale,
    keyPath,
    typedKeyPath,
    fieldId,
    fieldLabel,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
  } = $props();

  let showQuickAddDialog = $state(false);
  /**
   * Entry to edit with the dialog, or `undefined` to create a new one.
   * @type {Entry | undefined}
   */
  let editingEntry = $state.raw();
  /**
   * Whether the dialog has been opened, which keeps it mounted while it closes, even if the field
   * no longer offers to create or edit an entry by then.
   */
  let dialogOpened = $state(false);

  // The entries created from this field, or another one referring to the same collection, are
  // offered along with the saved ones until they’re saved too
  const refEntries = $derived(getRefEntriesWithPending({ draft: entryDraft.current, fieldConfig }));
  /** @type {SelectField} */
  const selectFieldConfig = $derived({
    ...fieldConfig,
    widget: 'select',
    options: getOptions({
      locale,
      fieldConfig,
      refEntries,
      currentLocaleValues: editorEntry.getValues(locale),
      currentSlug: editorEntry.getSlug(locale),
      // A filter can refer to a field that isn’t localized, which only has a value in the default
      // locale
      sharedValues: editorEntry.getSharedValues(locale),
      // A label can refer to another pending entry through a Relation field of the entry
      pendingEntries: getUnlistedEntries(entryDraft.current),
    }),
  });
  const creatableCollection = $derived(
    readonly || !entryDraft.current
      ? undefined
      : getCreatableCollection({ fieldConfig, draft: entryDraft.current }),
  );
  const canCreate = $derived(
    !!creatableCollection &&
      !!entryDraft.current &&
      hasCreationRoom({ collection: creatableCollection, draft: entryDraft.current }),
  );
  // The selected entries that can be edited with the dialog
  const editableEntries = $derived(
    readonly || !entryDraft.current
      ? []
      : getEditableEntries({
          draft: entryDraft.current,
          locale,
          fieldConfig,
          refEntries,
          currentValue,
        }),
  );
  // The collection the dialog creates or edits an entry in. An entry can only be edited in an
  // entry collection, see `canEditEntry()`
  const refCollection = $derived(
    /** @type {InternalEntryCollection} */ (getCollection(fieldConfig.collection)),
  );
  // Whether an entry can be created or edited with the dialog. The collection that can have an
  // entry created in is the referenced one, see `getCreatableCollection()`
  const hasDialogActions = $derived(!!creatableCollection || !!editableEntries.length);
  /* v8 ignore start -- the app locale is always set once the UI strings are loaded */
  // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label. Only
  // read while a button is rendered, which needs the collection
  const collectionName = $derived(
    appLocale.current ? getCollectionLabel(refCollection, { useSingular: true }) : '',
  );
  /* v8 ignore stop */

  /**
   * Open the dialog to create a new entry, or edit the given one.
   * @param {Entry} [entry] Entry to edit.
   */
  const openDialog = (entry) => {
    dialogOpened = true;
    editingEntry = entry;
    showQuickAddDialog = true;
  };
</script>

<div role="none" class="wrapper">
  <SelectEditor
    {locale}
    {keyPath}
    {typedKeyPath}
    {fieldId}
    {fieldLabel}
    fieldConfig={selectFieldConfig}
    bind:currentValue
    {readonly}
    {required}
    {invalid}
  />
  {#if hasDialogActions}
    <div role="none" class="actions">
      {#if creatableCollection}
        <Button
          variant="tertiary"
          size="small"
          label={_('add_x', { values: { name: collectionName } })}
          disabled={!canCreate}
          aria-haspopup="dialog"
          onclick={() => {
            openDialog();
          }}
        >
          {#snippet startIcon()}
            <Icon name="add" />
          {/snippet}
        </Button>
      {/if}
      {#if fieldConfig.multiple && editableEntries.length}
        <MenuButton
          variant="tertiary"
          size="small"
          label={_('edit_x', { values: { name: collectionName } })}
        >
          {#snippet startIcon()}
            <Icon name="edit" />
          {/snippet}
          {#snippet endIcon()}{/snippet}
          {#snippet popup()}
            <Menu ariaLabel={_('relation_field.select_entry_to_edit')}>
              {#each editableEntries as { label, entry } (entry.id)}
                <MenuItem
                  {label}
                  aria-haspopup="dialog"
                  onclick={() => {
                    openDialog(entry);
                  }}
                />
              {/each}
            </Menu>
          {/snippet}
        </MenuButton>
      {:else if editableEntries.length}
        {@const [{ label, entry }] = editableEntries}
        <Button
          variant="tertiary"
          size="small"
          label={_('edit_x', { values: { name: label } })}
          aria-haspopup="dialog"
          onclick={() => {
            openDialog(entry);
          }}
        >
          {#snippet startIcon()}
            <Icon name="edit" />
          {/snippet}
        </Button>
      {/if}
    </div>
  {/if}
  {#if hasDialogActions || dialogOpened}
    <QuickAddDialog
      bind:open={showQuickAddDialog}
      collection={refCollection}
      {fieldConfig}
      entry={editingEntry}
      onAdd={(pendingEntry, previousEntry) => {
        /* v8 ignore next -- the entry is only added while the draft is being edited */
        if (!entryDraft.current) {
          return;
        }

        const args = { draft: entryDraft.current, keyPath, valueStoreKey, fieldConfig };

        if (previousEntry) {
          replaceEntryValues({ ...args, previousEntry, entry: pendingEntry.entry });
        } else {
          selectPendingEntry({ ...args, locale, pendingEntry });
        }
      }}
    />
  {/if}
</div>

<style>
  .wrapper {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .actions {
    display: flex;
  }
</style>
