<!--
  @component
  Implement the editor for the Object widget.
  @see https://decapcms.org/docs/widgets/#object
-->
<script>
  import { Checkbox, Group } from '@sveltia/ui';
  import { generateUUID } from '@sveltia/utils/crypto';
  import { waitForVisibility } from '@sveltia/utils/element';
  import { sleep } from '@sveltia/utils/misc';
  import { toRaw } from '@sveltia/utils/object';
  import { onMount, tick } from 'svelte';
  import { _ } from 'svelte-i18n';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import AddItemButton from '$lib/components/contents/details/widgets/object/add-item-button.svelte';
  import ObjectHeader from '$lib/components/contents/details/widgets/object/object-header.svelte';
  import { entryDraft, i18nAutoDupEnabled } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/create';
  import { syncExpanderStates } from '$lib/services/contents/draft/editor';
  import { copyDefaultLocaleValues } from '$lib/services/contents/draft/update';
  import { getFieldConfig } from '$lib/services/contents/entry/fields';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';
  import { formatSummary } from '$lib/services/contents/widgets/object/helper';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
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
    name: fieldName,
    i18n = false,
    // Widget-specific options
    collapsed = false,
    summary,
    fields,
    types,
    typeKey = 'type',
  } = fieldConfig);

  $: ({ collectionName, fileName, collection, collectionFile, currentValues, expanderStates } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: valueMap = currentValues[locale];
  $: hasValues = Object.entries(valueMap).some(
    ([_keyPath, value]) =>
      !!_keyPath.startsWith(`${keyPath}.`) &&
      (value !== null ||
        getFieldConfig({ collectionName, fileName, valueMap, keyPath: _keyPath })?.widget ===
          'object'),
  );
  $: canEdit = locale === defaultLocale || i18n !== false;
  $: parentExpandedKeyPath = `${keyPath}#`;
  $: parentExpanded = expanderStates?._[parentExpandedKeyPath] ?? true;
  $: hasVariableTypes = Array.isArray(types);
  $: typeKeyPath = `${keyPath}.${typeKey}`;
  $: typeConfig = hasVariableTypes
    ? types?.find(({ name }) => name === valueMap[typeKeyPath])
    : undefined;
  $: subFields = (hasVariableTypes ? typeConfig?.fields : fields) ?? [];
  $: summaryTemplate = hasVariableTypes ? typeConfig?.summary || summary : summary;
  $: addButtonDisabled = locale !== defaultLocale && i18n === 'duplicate';

  let widgetId = '';
  /** @type {HTMLElement | undefined} */
  let wrapper;

  onMount(() => {
    widgetId = generateUUID('short');

    // Initialize the expander state
    syncExpanderStates({
      [parentExpandedKeyPath]: expanderStates?._[parentExpandedKeyPath] ?? !collapsed,
    });
  });

  /**
   * Add the object’s subfields to the entry draft with the default values populated.
   * @param {string} [typeName] - Variable type name. If the field doesn’t have variable types, it
   * will be `undefined`.
   */
  const addFields = async (typeName) => {
    // Avoid triggering the Proxy’s i18n duplication strategy for descendant fields
    $i18nAutoDupEnabled = false;

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
        Object.entries(getDefaultValues(subFields, locale)) //
          .map(([_keyPath, value]) => [`${keyPath}.${_keyPath}`, value]),
      ),
    );

    Object.entries($entryDraft?.currentValues ?? {}).forEach(([_locale, _valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        // Apply the new values while keeping the Proxy
        /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale] = Object.assign(
          _valueMap,
          toRaw({ ...newValueMap, ..._valueMap }),
        );

        // Disable validation
        delete (/** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][keyPath]);
      }
    });

    $i18nAutoDupEnabled = true;
  };

  /**
   * Remove the object’s subfields from the entry draft.
   */
  const removeFields = () => {
    $i18nAutoDupEnabled = false;

    Object.entries($entryDraft?.currentValues ?? {}).forEach(([_locale, _valueMap]) => {
      if (_locale === locale || i18n === 'duplicate') {
        Object.keys(_valueMap).forEach((_keyPath) => {
          if (_keyPath.startsWith(`${keyPath}.`)) {
            /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][_keyPath] = null;
            delete $entryDraft?.currentValues[_locale][_keyPath];
          }
        });

        // Enable validation
        /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][keyPath] = null;
      }
    });

    $i18nAutoDupEnabled = true;
  };

  /**
   * Format the summary template.
   * @returns {string} Formatted summary.
   */
  const _formatSummary = () =>
    formatSummary({
      collectionName,
      fileName,
      keyPath,
      valueMap,
      locale,
      summaryTemplate,
    });
</script>

{#if !required}
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
  <div role="none" class="wrapper">
    <Group aria-labelledby={parentExpanded ? undefined : `object-${widgetId}-summary`}>
      <ObjectHeader
        label={hasVariableTypes ? typeConfig?.label || typeConfig?.name : ''}
        controlId="object-{widgetId}-item-list"
        expanded={parentExpanded}
        toggleExpanded={() => {
          syncExpanderStates({ [parentExpandedKeyPath]: !parentExpanded });
        }}
        removeButtonVisible={hasVariableTypes}
        removeButtonDisabled={addButtonDisabled}
        remove={() => {
          removeFields();
        }}
      />
      <div role="none" class="item-list" id="object-{widgetId}-item-list" bind:this={wrapper}>
        {#await waitForVisibility(wrapper) then}
          {#if parentExpanded}
            {#each subFields as subField (subField.name)}
              {#await sleep(0) then}
                <FieldEditor
                  keyPath={[keyPath, subField.name].join('.')}
                  {locale}
                  fieldConfig={subField}
                />
              {/await}
            {/each}
          {:else}
            <div role="none" class="summary" id="object-{widgetId}-summary">
              {_formatSummary()}
            </div>
          {/if}
        {/await}
      </div>
    </Group>
  </div>
{/if}

<style lang="scss">
  .wrapper {
    display: contents;

    :global(.sui.checkbox) + & {
      & > :global(.group) {
        margin-top: 8px;
      }
    }

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

    &:empty {
      display: none;
    }
  }
</style>
