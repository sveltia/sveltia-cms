<!--
  @component
  Implement the editor for a Relation field.
  @see https://decapcms.org/docs/widgets/#Relation
  @see https://sveltiacms.app/en/docs/fields/relation
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';
  import { getContext } from 'svelte';

  import QuickAddDialog from '$lib/components/contents/details/fields/relation/quick-add-dialog.svelte';
  import SelectEditor from '$lib/components/contents/details/fields/select/select-editor.svelte';
  import { getCollectionLabel } from '$lib/services/contents/collection';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getOptions, getRefEntries } from '$lib/services/contents/fields/relation/helpers';
  import {
    getCreatableCollection,
    getPendingRefEntries,
    hasCreationRoom,
    selectPendingEntry,
  } from '$lib/services/contents/fields/relation/quick-add';

  /**
   * @import { FieldEditorContext, FieldEditorProps } from '$lib/types/private';
   * @import { RelationField, SelectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {RelationField} fieldConfig Field configuration.
   * @property {string | string[] | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const { valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
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
    /* eslint-enable prefer-const */
  } = $props();

  let showQuickAddDialog = $state(false);

  const refEntries = $derived.by(() => {
    const entries = getRefEntries(fieldConfig);

    // The entries created from this field, or another one referring to the same collection, are
    // offered along with the saved ones until they’re saved too
    const pendingEntries = getPendingRefEntries({
      draft: entryDraft.current,
      fieldConfig,
      refEntries: entries,
    });

    return pendingEntries.length ? [...entries, ...pendingEntries] : entries;
  });
  const currentLocaleValues = $derived(entryDraft.current?.[valueStoreKey]?.[locale]);
  const currentSlug = $derived(
    entryDraft.current?.currentSlugs[locale] ?? entryDraft.current?.currentSlugs._,
  );
  /** @type {SelectField} */
  const selectFieldConfig = $derived({
    ...fieldConfig,
    widget: 'select',
    options: getOptions({
      locale,
      fieldConfig,
      refEntries,
      currentLocaleValues,
      currentSlug,
      // A label can refer to another pending entry through a Relation field of the entry
      pendingEntries: entryDraft.current?.pendingEntries,
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
  /* v8 ignore start -- only read while the button is rendered, which needs the collection */
  // `appLocale.current` is a key, because `getCollectionLabel` can return a localized label
  const creatableName = $derived(
    creatableCollection && appLocale.current
      ? getCollectionLabel(creatableCollection, { useSingular: true })
      : '',
  );
  /* v8 ignore stop */
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
    sortOptions={true}
  />
  {#if creatableCollection}
    <div role="none" class="actions">
      <Button
        variant="tertiary"
        size="small"
        label={_('add_x', { values: { name: creatableName } })}
        disabled={!canCreate}
        aria-haspopup="dialog"
        onclick={() => {
          showQuickAddDialog = true;
        }}
      >
        {#snippet startIcon()}
          <Icon name="add" />
        {/snippet}
      </Button>
    </div>
    <QuickAddDialog
      bind:open={showQuickAddDialog}
      collection={creatableCollection}
      {fieldConfig}
      onAdd={(pendingEntry) => {
        /* v8 ignore next -- the entry is only added while the draft is being edited */
        if (entryDraft.current) {
          selectPendingEntry({
            draft: entryDraft.current,
            locale,
            keyPath,
            valueStoreKey,
            fieldConfig,
            pendingEntry,
          });
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
