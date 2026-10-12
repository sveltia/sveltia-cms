<!--
  @component
  Implement the editor for an Object field.
  @see https://decapcms.org/docs/widgets/#Object
  @see https://sveltiacms.app/en/docs/fields/object
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Checkbox } from '@sveltia/ui';
  import { getContext, onMount, tick } from 'svelte';

  import RemoveButton from '$lib/components/common/remove-button.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import ObjectBody from '$lib/components/contents/details/fields/object/object-body.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { addObjectFields, removeObjectFields } from '$lib/services/contents/draft/update/object';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getInitialExpanderState,
    isExpanded,
    syncExpanderStates,
  } from '$lib/services/contents/editor/fields';
  import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
  import {
    formatSummary,
    getTypedSubKeyPath,
    resolveVariableType,
    warnUnknownType,
  } from '$lib/services/contents/fields/object/helpers';
  import { getDraftObjectThumbnail } from '$lib/services/contents/fields/object/thumbnail';

  /**
   * @import {
   * EntryDraft,
   * FieldEditorContext,
   * FieldEditorProps,
   * MediaFieldSource,
   * } from '$lib/types/private';
   * @import {
   * ObjectField,
   * ObjectFieldWithSubFields,
   * ObjectFieldWithTypes,
   * } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ObjectField} fieldConfig Field configuration.
   * @property {object | undefined} currentValue Field value.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {FieldEditorContext} */
  const {
    fieldContext,
    valueStoreKey = 'currentValues',
    parentComponentNames = [],
  } = getContext('field-editor') ?? {};
  const componentName = parentComponentNames.at(-1);
  // Hide the header/expander if in a single subfield list field because it’s redundant
  const hideHeader = fieldContext === 'single-subfield-list-field';

  /** @type {FieldEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldLabel,
    fieldConfig,
    required = true,
    // `FieldEditor` only renders the editor in a locale where the field is shown, and makes it
    // read-only in a locale whose values follow the default locale
    readonly = false,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {AddItemButton | undefined} */
  let addItemButton = $state();

  const {
    name: fieldName,
    // Field type-specific options
    collapsed,
    summary,
    thumbnail: thumbnailFieldName,
  } = $derived(fieldConfig);
  const { fields } = $derived(/** @type {ObjectFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ObjectFieldWithTypes} */ (fieldConfig));
  /* v8 ignore start -- the editor is only rendered while the draft is there */
  const isIndexFile = $derived(entryDraft.current?.isIndexFile ?? false);
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  /* v8 ignore stop */
  const fileName = $derived(entryDraft.current?.fileName);
  const valueMap = $derived(
    getFieldValueMapSnapshot(entryDraft.current, locale, keyPath, valueStoreKey),
  );
  const getFieldArgs = $derived({ collectionName, fileName, valueMap, isIndexFile });
  // Ask the shared key path index rather than scanning the whole value map: the editor renders one
  // component per field, and a large entry would otherwise be walked once per Object field on
  // every keystroke
  const hasValues = $derived(
    getKeysByPrefix(valueMap, `${keyPath}.`).some((_keyPath) => valueMap[_keyPath] !== undefined),
  );
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  const parentExpanded = $derived(isExpanded(entryDraft.current, parentExpandedKeyPath));
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  /* v8 ignore start -- only read for an object with variable types */
  const type = $derived(hasVariableTypes ? valueMap[typeKeyPath] : undefined);
  /* v8 ignore stop */
  const { typeConfig, unknownType, subFields, summaryTemplate } = $derived(
    resolveVariableType({ types: hasVariableTypes ? types : undefined, fields, summary, type }),
  );

  /**
   * Initialize the expander state.
   */
  const initializeExpanderState = () => {
    const draft = entryDraft.current;

    if (hideHeader || !draft) {
      return;
    }

    const key = parentExpandedKeyPath;

    syncExpanderStates({
      draft,
      stateMap: { [key]: getInitialExpanderState({ draft, key, locale, collapsed }) },
    });
  };

  /**
   * Add the object’s subfields to the entry draft with the default values populated.
   * @param {object} [args] Arguments.
   * @param {string} [args.type] Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   */
  const addFields = ({ type: _type } = {}) => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the button is only offered while the draft is there */
    if (!draft) {
      return;
    }

    addObjectFields({ draft, valueStoreKey, locale, keyPath, fieldConfig, type: _type });
  };

  /**
   * Remove the object’s subfields from the entry draft.
   */
  const removeFields = () => {
    removeObjectFields({
      // The Remove button is only offered while the draft is there
      draft: /** @type {EntryDraft} */ (entryDraft.current),
      valueStoreKey,
      locale,
      keyPath,
      fieldConfig,
    });
  };

  /**
   * Add the subfields of the type picked from the Add menu. The menu button is gone along with the
   * menu once the object takes its place, so move the focus to the object’s expander button. The
   * header is hidden within a single-subfield list, whose item has an expander of its own.
   * @param {object} args Arguments.
   * @param {string} [args.type] Variable type name.
   */
  const addTypedFields = async ({ type: _type }) => {
    addFields({ type: _type });
    await tick();
    /** @type {HTMLElement | null} */ (
      /** @type {HTMLElement} */ (wrapper).querySelector(':scope > .header button')
    )?.focus();
  };

  /**
   * Remove the subfields of an object with variable types. The focused Remove button is gone along
   * with them, so move the focus to the Add button that takes the object’s place.
   */
  const removeTypedFields = async () => {
    removeFields();
    await tick();
    /** @type {AddItemButton} */ (addItemButton).focus();
  };

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = () => formatSummary({ ...getFieldArgs, keyPath, locale, summaryTemplate });

  /**
   * Get the thumbnail of the collapsed object.
   * @returns {MediaFieldSource | undefined} Thumbnail.
   */
  const getThumbnail = () =>
    getDraftObjectThumbnail({
      draft: entryDraft.current,
      thumbnailFieldName,
      keyPath,
      typedKeyPath,
      type,
      componentName,
      valueMap,
      locale,
    });

  // Worked out only while the object is collapsed, and shared with the body showing them
  const summaryText = $derived(_formatSummary());
  const thumbnailSource = $derived(getThumbnail());
  const summaryId = `object-${fieldId}-summary`;
  // The summary labels the object while collapsed, but the body only renders it for a known type
  // if there’s something to show
  const labelledBy = $derived(
    !parentExpanded && !unknownType && (summaryText || thumbnailSource) ? summaryId : undefined,
  );

  onMount(() => {
    initializeExpanderState();

    if (hasValues && unknownType) {
      warnUnknownType({ fieldType: 'object', keyPath, type, typeKey, types });
    }
  });
</script>

{#if !hasVariableTypes && !required}
  <Checkbox
    label={_('add_x', { values: { name: fieldLabel || fieldName } })}
    checked={hasValues}
    disabled={readonly}
    onChange={({ detail: { checked } }) => {
      if (checked) {
        addFields();
      } else {
        removeFields();
      }
    }}
  />
{/if}

{#if hasVariableTypes && !hasValues}
  <AddItemButton
    bind:this={addItemButton}
    disabled={readonly}
    {fieldConfig}
    addItem={(args) => addTypedFields(/** @type {{ type: string }} */ (args))}
  />
{/if}

{#if !(!required || hasVariableTypes) || hasValues}
  <div
    bind:this={wrapper}
    role="group"
    class="wrapper"
    class:unknown-type={unknownType}
    class:expanded={parentExpanded}
    aria-labelledby={labelledBy}
  >
    {#if !hideHeader}
      <ObjectHeader
        label={hasVariableTypes ? typeConfig?.label || type : ''}
        controlId="object-{fieldId}-item-list"
        expanded={parentExpanded}
        toggleExpanded={subFields.length
          ? () =>
              syncExpanderStates({
                draft: /** @type {EntryDraft} */ (entryDraft.current),
                stateMap: { [parentExpandedKeyPath]: !parentExpanded },
              })
          : undefined}
      >
        {#snippet endContent()}
          {#if hasVariableTypes}
            <RemoveButton
              disabled={readonly}
              onclick={() => {
                removeTypedFields();
              }}
            />
          {/if}
        {/snippet}
      </ObjectHeader>
    {/if}
    <div role="none" class="item-list" id="object-{fieldId}-item-list">
      <ObjectBody
        {locale}
        {subFields}
        getSubFieldProps={(subField) => ({
          keyPath: `${keyPath}.${subField.name}`,
          typedKeyPath: getTypedSubKeyPath({ typedKeyPath, type, subFieldName: subField.name }),
        })}
        expanded={parentExpanded}
        {unknownType}
        getSummary={() => summaryText}
        getThumbnail={() => thumbnailSource}
        {summaryId}
      />
    </div>
  </div>
{/if}

<style>
  .wrapper {
    border-inline-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

    &.expanded,
    &:has(:global(.summary)) {
      border-bottom-width: 2px;
    }

    &.unknown-type {
      overflow: hidden;

      :global(.alert) {
        border-width: 0;
        border-radius: 0;
      }
    }
  }

  :global(.sui.checkbox) + .wrapper {
    & > :global(.group) {
      margin-top: 8px;
    }
  }
</style>
