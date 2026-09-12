<!--
  @component
  Implement the editor for an Object field.
  @see https://decapcms.org/docs/widgets/#Object
  @see https://sveltiacms.app/en/docs/fields/object
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Checkbox, Icon, TruncatedText, VisibilityObserver } from '@sveltia/ui';
  import { toRaw } from '@sveltia/utils/object';
  import { getContext, onMount, tick } from 'svelte';

  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/fields/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/fields/object/object-header.svelte';
  import { suspendAutoDuplication } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    copyDefaultLocaleValues,
    forEachTargetLocale,
  } from '$lib/services/contents/draft/update/locale';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import {
    getInitialExpanderState,
    syncExpanderStates,
  } from '$lib/services/contents/editor/fields';
  import { getKeysByPrefix } from '$lib/services/contents/entry/key-paths';
  import { formatSummary } from '$lib/services/contents/fields/object/helpers';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { EntryDraft, FieldEditorContext, FieldEditorProps } from '$lib/types/private';
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
  const { fieldContext, valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};
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
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  const {
    name: fieldName,
    i18n = false,
    // Field type-specific options
    collapsed,
    summary,
  } = $derived(fieldConfig);
  const { fields } = $derived(/** @type {ObjectFieldWithSubFields} */ (fieldConfig));
  const { types, typeKey = 'type' } = $derived(/** @type {ObjectFieldWithTypes} */ (fieldConfig));
  const isIndexFile = $derived(entryDraft.current?.isIndexFile ?? false);
  const collectionName = $derived(entryDraft.current?.collectionName ?? '');
  const fileName = $derived(entryDraft.current?.fileName);
  const defaultLocale = $derived(entryDraft.current?.defaultLocale);
  const valueMap = $derived(getValueMapSnapshot(entryDraft.current, locale, valueStoreKey));
  const getFieldArgs = $derived({ collectionName, fileName, valueMap, isIndexFile });
  const hasValues = $derived(
    Object.entries(valueMap).some(
      ([_keyPath, value]) => _keyPath.startsWith(`${keyPath}.`) && value !== undefined,
    ),
  );
  const canEdit = $derived(
    fieldContext === 'rich-text-editor-component' || locale === defaultLocale || i18n !== false,
  );
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  const parentExpanded = $derived(
    entryDraft.current?.expanderStates?._[parentExpandedKeyPath] ?? true,
  );
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  const type = $derived(hasVariableTypes ? valueMap[typeKeyPath] : undefined);
  const typeConfig = $derived(type ? types?.find(({ name }) => name === type) : undefined);
  const unknownType = $derived(hasVariableTypes && !typeConfig);
  const subFields = $derived((hasVariableTypes ? typeConfig?.fields : fields) ?? []);
  const summaryTemplate = $derived(hasVariableTypes ? typeConfig?.summary || summary : summary);
  const addButtonDisabled = $derived(locale !== defaultLocale && i18n === 'duplicate');

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
   * @returns {Promise<void>} A promise that resolves once the fields have been added.
   */
  const addFields = async ({ type: _type } = {}) =>
    // Avoid triggering the Proxy’s i18n duplication strategy for descendant fields. The suspension
    // has to span the `await` below, because the values are written after it
    suspendAutoDuplication(async () => {
      const draft = entryDraft.current;

      if (!draft) {
        return;
      }

      if (_type) {
        forEachTargetLocale({ valueStore: draft[valueStoreKey], locale, i18n }, (_valueMap) => {
          _valueMap[typeKeyPath] = _type;
        });

        // Wait until `subFields` is updated
        await tick();
      }

      const newContent = Object.fromEntries(
        Object.entries(
          getDefaultValues({ fields: subFields, locale, defaultLocale: draft.defaultLocale }),
        ) //
          .map(([_keyPath, value]) => [`${keyPath}.${_keyPath}`, value]),
      );

      const newValueMap =
        locale === defaultLocale
          ? newContent
          : copyDefaultLocaleValues({
              draft,
              content: newContent,
              targetLanguage: locale,
              keyPathPrefix: keyPath,
            });

      forEachTargetLocale({ valueStore: draft[valueStoreKey], locale, i18n }, (_valueMap) => {
        // Apply the new values through the Proxy
        Object.assign(_valueMap, toRaw({ ...newValueMap, ..._valueMap }));

        // Disable validation
        delete _valueMap[keyPath];
      });
    });

  /**
   * Remove the object’s subfields from the entry draft.
   */
  const removeFields = () => {
    forEachTargetLocale(
      { valueStore: entryDraft.current?.[valueStoreKey], locale, i18n },
      (_valueMap) => {
        // Assign `null` before deleting each property, so the draft proxy can revalidate the field.
        // The value map is the draft’s live map, which is mutated right below, so its key paths
        // have to be read as they are right now
        getKeysByPrefix(_valueMap, `${keyPath}.`, { live: true }).forEach((_keyPath) => {
          _valueMap[_keyPath] = null;
          delete _valueMap[_keyPath];
        });

        // Enable validation
        _valueMap[keyPath] = null;
      },
    );
  };

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = () => formatSummary({ ...getFieldArgs, keyPath, locale, summaryTemplate });

  /**
   * Warn about unknown variable type.
   */
  const warnUnknownType = () => {
    const message = type
      ? `The “${type}” type is not defined for the object field.`
      : `The type key is not found in the object. The item must include the “${typeKey}” ` +
        `property with one of the defined types: ${types.map((t) => t.name).join(', ')}`;

    // eslint-disable-next-line no-console
    console.warn(`List item ${keyPath}: ${message}`);
  };

  onMount(() => {
    initializeExpanderState();

    if (canEdit && hasValues && unknownType) {
      warnUnknownType();
    }
  });
</script>

{#if !hasVariableTypes && !required}
  <Checkbox
    label={_('add_x', { values: { name: fieldLabel || fieldName } })}
    checked={hasValues}
    disabled={addButtonDisabled}
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
  <AddItemButton disabled={addButtonDisabled} {fieldConfig} addItem={addFields} />
{/if}

{#if (!(!required || hasVariableTypes) || hasValues) && canEdit}
  <div
    role="group"
    class="wrapper"
    class:unknown-type={unknownType}
    class:expanded={parentExpanded}
    aria-labelledby={parentExpanded ? undefined : `object-${fieldId}-summary`}
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
            <Button
              size="small"
              iconic
              disabled={addButtonDisabled}
              aria-label={_('remove')}
              onclick={() => {
                removeFields();
              }}
            >
              {#snippet startIcon()}
                <Icon name="close" />
              {/snippet}
            </Button>
          {/if}
        {/snippet}
      </ObjectHeader>
    {/if}
    <div role="none" class="item-list" id="object-{fieldId}-item-list">
      {#if unknownType}
        <Alert status="warning">{_('unknown_variable_type')}</Alert>
      {:else if parentExpanded}
        {#each subFields as subField (subField.name)}
          {@const subFieldKeyPath = `${keyPath}.${subField.name}`}
          <VisibilityObserver>
            <FieldEditor
              keyPath={subFieldKeyPath}
              typedKeyPath={hasVariableTypes && type
                ? `${typedKeyPath}<${type}>.${subField.name}`
                : subFieldKeyPath}
              {locale}
              fieldConfig={subField}
            />
          </VisibilityObserver>
        {/each}
      {:else}
        {@const formattedSummary = _formatSummary()}
        {#if formattedSummary}
          <div role="none" class="summary" id="object-{fieldId}-summary">
            <TruncatedText lines={env.isSmallScreen ? 2 : 1}>
              {formattedSummary}
            </TruncatedText>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style>
  .wrapper {
    border-inline-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

    &.expanded,
    &:has(.summary) {
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

  .summary {
    padding: 8px;
  }
</style>
