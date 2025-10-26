<!--
  @component
  Implement the editor for the Object widget.
  @see https://decapcms.org/docs/widgets/#Object
-->
<script>
  import { Button, Checkbox, Icon, TruncatedText } from '@sveltia/ui';
  import { toRaw } from '@sveltia/utils/object';
  import { getContext, onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/widgets/object/object-header.svelte';
  import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';
  import { copyDefaultLocaleValues } from '$lib/services/contents/draft/update/locale';
  import {
    getInitialExpanderState,
    syncExpanderStates,
  } from '$lib/services/contents/editor/expanders';
  import { getField } from '$lib/services/contents/entry/fields';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { formatSummary } from '$lib/services/contents/widgets/object/helper';
  import { isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { EntryDraft, FieldEditorContext, WidgetEditorProps } from '$lib/types/private';
   * @import { ObjectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ObjectField} fieldConfig Field configuration.
   * @property {object | undefined} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { widgetContext, valueStoreKey = 'currentValues' } = getContext('field-editor') ?? {};
  // Hide the header/expander if in a single subfield list widget because it’s redundant
  const hideHeader = widgetContext === 'single-subfield-list-widget';

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldLabel,
    fieldConfig,
    required = true,
    /* eslint-enable prefer-const */
  } = $props();

  const widgetId = $props.id();

  const {
    name: fieldName,
    i18n = false,
    // Widget-specific options
    collapsed,
    summary,
    fields,
    types,
    typeKey = 'type',
  } = $derived(fieldConfig);
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collection = $derived($entryDraft?.collection);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const collectionFile = $derived($entryDraft?.collectionFile);
  const fileName = $derived($entryDraft?.fileName);
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const valueMap = $derived($state.snapshot($entryDraft?.[valueStoreKey][locale]) ?? {});
  const getFieldArgs = $derived({ collectionName, fileName, valueMap, isIndexFile });
  const hasValues = $derived(
    Object.entries(valueMap).some(
      ([_keyPath, value]) =>
        !!_keyPath.startsWith(`${keyPath}.`) &&
        (value !== null || getField({ ...getFieldArgs, keyPath: _keyPath })?.widget === 'object'),
    ),
  );
  const canEdit = $derived(
    widgetContext === 'markdown-editor-component' || locale === defaultLocale || i18n !== false,
  );
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  const parentExpanded = $derived($entryDraft?.expanderStates?._[parentExpandedKeyPath] ?? true);
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  const typeConfig = $derived(
    hasVariableTypes ? types?.find(({ name }) => name === valueMap[typeKeyPath]) : undefined,
  );
  const subFields = $derived((hasVariableTypes ? typeConfig?.fields : fields) ?? []);
  const summaryTemplate = $derived(hasVariableTypes ? typeConfig?.summary || summary : summary);
  const addButtonDisabled = $derived(locale !== defaultLocale && i18n === 'duplicate');

  /**
   * Initialize the expander state.
   */
  const initializeExpanderState = () => {
    if (hideHeader) {
      return;
    }

    const key = parentExpandedKeyPath;

    syncExpanderStates({ [key]: getInitialExpanderState({ key, locale, collapsed }) });
  };

  /**
   * Add the object’s subfields to the entry draft with the default values populated.
   * @param {object} [args] Arguments.
   * @param {string} [args.type] Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   */
  const addFields = async ({ type } = {}) => {
    // Avoid triggering the Proxy’s i18n duplication strategy for descendant fields
    $i18nAutoDupEnabled = false;

    if (type) {
      Object.keys($entryDraft?.[valueStoreKey] ?? {}).forEach((_locale) => {
        if (_locale === locale || i18n === 'duplicate') {
          /** @type {EntryDraft} */ ($entryDraft)[valueStoreKey][_locale][typeKeyPath] = type;
        }
      });

      // Wait until `subFields` is updated
      await tick();
    }

    const newContent = Object.fromEntries(
      Object.entries(getDefaultValues(subFields, locale)) //
        .map(([_keyPath, value]) => [`${keyPath}.${_keyPath}`, value]),
    );

    const newValueMap = locale === defaultLocale ? newContent : copyDefaultLocaleValues(newContent);

    Object.entries($entryDraft?.[valueStoreKey] ?? {}).forEach(([_locale, _valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        // Apply the new values while keeping the Proxy
        /** @type {EntryDraft} */ ($entryDraft)[valueStoreKey][_locale] = Object.assign(
          _valueMap,
          toRaw({ ...newValueMap, ..._valueMap }),
        );

        // Disable validation
        delete (/** @type {EntryDraft} */ ($entryDraft)[valueStoreKey][_locale][keyPath]);
      }
    });

    $i18nAutoDupEnabled = true;
  };

  /**
   * Remove the object’s subfields from the entry draft.
   */
  const removeFields = () => {
    $i18nAutoDupEnabled = false;

    Object.entries($entryDraft?.[valueStoreKey] ?? {}).forEach(([_locale, _valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        Object.keys(_valueMap).forEach((_keyPath) => {
          if (_keyPath.startsWith(`${keyPath}.`)) {
            /** @type {EntryDraft} */ ($entryDraft)[valueStoreKey][_locale][_keyPath] = null;
            delete $entryDraft?.[valueStoreKey][_locale][_keyPath];
          }
        });

        // Enable validation
        /** @type {EntryDraft} */ ($entryDraft)[valueStoreKey][_locale][keyPath] = null;
      }
    });

    $i18nAutoDupEnabled = true;
  };

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = () => formatSummary({ ...getFieldArgs, keyPath, locale, summaryTemplate });

  onMount(() => {
    initializeExpanderState();
  });
</script>

{#if !hasVariableTypes && !required}
  <Checkbox
    label={$_('add_x', { values: { name: fieldLabel || fieldName } })}
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
    aria-labelledby={parentExpanded ? undefined : `object-${widgetId}-summary`}
  >
    {#if !hideHeader}
      <ObjectHeader
        label={hasVariableTypes ? typeConfig?.label || typeConfig?.name : ''}
        controlId="object-{widgetId}-item-list"
        expanded={parentExpanded}
        toggleExpanded={subFields.length
          ? () => syncExpanderStates({ [parentExpandedKeyPath]: !parentExpanded })
          : undefined}
      >
        {#snippet endContent()}
          {#if hasVariableTypes}
            <Button
              size="small"
              iconic
              disabled={addButtonDisabled}
              aria-label={$_('remove')}
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
    <div role="none" class="item-list" id="object-{widgetId}-item-list">
      {#if parentExpanded}
        {#each subFields as subField (subField.name)}
          {@const subFieldKeyPath = `${keyPath}.${subField.name}`}
          <VisibilityObserver>
            <FieldEditor
              keyPath={subFieldKeyPath}
              typedKeyPath={hasVariableTypes && typeConfig?.name
                ? `${keyPath}<${typeConfig.name}>.${subField.name}`
                : subFieldKeyPath}
              {locale}
              fieldConfig={subField}
            />
          </VisibilityObserver>
        {/each}
      {:else}
        {@const formattedSummary = _formatSummary()}
        {#if formattedSummary}
          <div role="none" class="summary" id="object-{widgetId}-summary">
            <TruncatedText lines={$isSmallScreen ? 2 : 1}>
              {formattedSummary}
            </TruncatedText>
          </div>
        {/if}
      {/if}
    </div>
  </div>
{/if}

<style lang="scss">
  .wrapper {
    border-width: 2px;
    border-color: var(--sui-secondary-border-color);
    border-radius: var(--sui-control-medium-border-radius);

    :global(.sui.checkbox) + & {
      & > :global(.group) {
        margin-top: 8px;
      }
    }
  }

  .summary {
    padding: 8px;
  }
</style>
