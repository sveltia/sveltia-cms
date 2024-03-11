<!--
  @component
  Implement the editor for the Object widget.
  @see https://decapcms.org/docs/widgets/#object
-->
<script>
  import { Group } from '@sveltia/ui';
  import { onMount, tick } from 'svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/widgets/object/object-header.svelte';
  import {
    copyDefaultLocaleValues,
    createProxy,
    entryDraft,
    getDefaultValues,
  } from '$lib/services/contents/editor';
  import { getFieldDisplayValue } from '$lib/services/contents/entry';
  import { defaultI18nConfig, getCanonicalLocale } from '$lib/services/contents/i18n';
  import { generateUUID } from '$lib/services/utils/strings';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  export let keyPath;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldId;
  /**
   * @type {string}
   */
  // svelte-ignore unused-export-let
  export let fieldLabel;
  /**
   * @type {ObjectField}
   */
  export let fieldConfig;
  /**
   * @type {object}
   */
  // svelte-ignore unused-export-let
  export let currentValue;
  /**
   * @type {boolean}
   */
  // svelte-ignore unused-export-let
  export let readonly = false;
  /**
   * @type {boolean}
   */
  export let required = false;
  /**
   * @type {boolean}
   */
  // svelte-ignore unused-export-let
  export let invalid = false;

  $: ({
    i18n = false,
    // Widget-specific options
    collapsed = false,
    summary,
    fields,
    types,
    typeKey = 'type',
  } = fieldConfig);

  $: ({ collectionName, fileName, collection, collectionFile, currentValues } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: valueMap = currentValues[locale];
  $: hasValues = Object.entries(valueMap).some(
    ([_keyPath, value]) => !!_keyPath.startsWith(`${keyPath}.`) && value !== null,
  );
  $: canEdit = locale === defaultLocale || i18n !== false;
  $: canonicalLocale = getCanonicalLocale(locale);
  $: listFormatter = new Intl.ListFormat(canonicalLocale, { style: 'narrow', type: 'conjunction' });
  $: parentExpanded = !collapsed;
  $: hasVariableTypes = Array.isArray(types);
  $: typeKeyPath = `${keyPath}.${typeKey}`;
  $: typeConfig = hasVariableTypes
    ? types?.find(({ name }) => name === valueMap[typeKeyPath])
    : undefined;
  $: subFields = (hasVariableTypes ? typeConfig?.fields : fields) ?? [];
  $: summaryTemplate = hasVariableTypes ? typeConfig?.summary || summary : summary;
  $: addButtonVisible = !required || hasVariableTypes;
  $: addButtonDisabled = locale !== defaultLocale && i18n === 'duplicate';

  let widgetId = '';

  onMount(() => {
    widgetId = generateUUID('short');
  });

  /**
   * Add the object’s subfields to the entry draft with the default values populated.
   * @param {string} [typeName] - Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   */
  const addFields = async (typeName) => {
    if (typeName) {
      Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
        if (_locale === locale || i18n === 'duplicate') {
          /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][typeKeyPath] = typeName;
        }
      });

      // Wait until `subFields` is updated
      await tick();
    }

    const newValueMap = copyDefaultLocaleValues(
      Object.fromEntries(
        Object.entries(getDefaultValues(subFields)) //
          .map(([_keyPath, value]) => [`${keyPath}.${_keyPath}`, value]),
      ),
    );

    Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
      if (_locale === locale || i18n === 'duplicate') {
        // Since we don’t want to trigger the Proxy’s i18n duplication strategy for descendant
        // fields, manually update the locale’s content and proxify the object again
        /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale] = createProxy({
          draft: $entryDraft,
          locale: _locale,
          target: { ...newValueMap, ...$entryDraft?.currentValues[_locale] },
        });

        // Disable validation
        delete (/** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][keyPath]);
      }
    });
  };

  /**
   * Remove the object’s subfields from the entry draft.
   */
  const removeFields = () => {
    Object.entries($entryDraft?.currentValues ?? {}).forEach(([_locale, _valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        Object.keys(_valueMap).forEach((_keyPath) => {
          if (_keyPath.startsWith(`${keyPath}.`)) {
            /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][_keyPath] = null;
            delete $entryDraft?.currentValues[_locale][_keyPath];
          }
        });

        if (required) {
          // Enable validation
          /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][keyPath] = null;
        }
      }
    });
  };

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const formatSummary = () => {
    if (!summaryTemplate) {
      return valueMap[`${keyPath}.title`] ?? valueMap[`${keyPath}.name`] ?? '';
    }

    return summaryTemplate.replaceAll(/{{fields\.(.+?)}}/g, (_match, _fieldName) => {
      const value = getFieldDisplayValue({
        collectionName,
        fileName,
        valueMap,
        keyPath: `${keyPath}.${_fieldName}`,
        locale,
      });

      return Array.isArray(value) ? listFormatter.format(value) : String(value);
    });
  };
</script>

{#if (!addButtonVisible || hasValues) && canEdit}
  <div role="none" class="wrapper">
    <Group aria-labelledby={parentExpanded ? undefined : `object-${widgetId}-summary`}>
      <ObjectHeader
        label={hasVariableTypes ? typeConfig?.label || typeConfig?.name : ''}
        controlId="object-{widgetId}-item-list"
        expanded={parentExpanded}
        toggleExpanded={() => {
          parentExpanded = !parentExpanded;
        }}
        removeButtonVisible={addButtonVisible}
        removeButtonDisabled={addButtonDisabled}
        remove={() => {
          removeFields();
        }}
      />
      <div role="none" class="item-list" id="object-{widgetId}-item-list">
        {#if parentExpanded}
          {#each subFields as subField (subField.name)}
            <FieldEditor
              keyPath={[keyPath, subField.name].join('.')}
              {locale}
              fieldConfig={subField}
            />
          {/each}
        {:else}
          <div role="none" class="summary" id="object-{widgetId}-summary">
            {formatSummary()}
          </div>
        {/if}
      </div>
    </Group>
  </div>
{/if}

{#if addButtonVisible && !hasValues && canEdit}
  <AddItemButton disabled={addButtonDisabled} {fieldConfig} addItem={addFields} />
{/if}

<style lang="scss">
  .wrapper {
    display: contents;

    & > :global(.group) {
      border-width: 2px;
      border-color: var(--sui-secondary-border-color);
      border-radius: var(--sui-control-medium-border-radius);
    }
  }

  .summary {
    overflow: hidden;
    padding: 8px;
    white-space: nowrap;
    text-overflow: ellipsis;
  }
</style>
