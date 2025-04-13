<!--
  @component
  Implement the editor for the Object widget.
  @see https://decapcms.org/docs/widgets/#object
-->
<script>
  import { Button, Checkbox, Icon, TruncatedText } from '@sveltia/ui';
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
  import { isSmallScreen } from '$lib/services/user/env';

  /**
   * @import { EntryDraft, WidgetEditorProps } from '$lib/types/private';
   * @import { ObjectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {ObjectField} fieldConfig Field configuration.
   * @property {object | undefined} currentValue Field value.
   */

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

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();

  const {
    name: fieldName,
    i18n = false,
    // Widget-specific options
    collapsed = false,
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
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale]) ?? {});
  const getFieldConfigArgs = $derived({ collectionName, fileName, valueMap, isIndexFile });
  const hasValues = $derived(
    Object.entries(valueMap).some(
      ([_keyPath, value]) =>
        !!_keyPath.startsWith(`${keyPath}.`) &&
        (value !== null ||
          getFieldConfig({ ...getFieldConfigArgs, keyPath: _keyPath })?.widget === 'object'),
    ),
  );
  const canEdit = $derived(locale === defaultLocale || i18n !== false);
  const parentExpandedKeyPath = $derived(`${keyPath}#`);
  const parentExpanded = $derived(
    $state.snapshot($entryDraft?.expanderStates?._[parentExpandedKeyPath]) ?? true,
  );
  const hasVariableTypes = $derived(Array.isArray(types));
  const typeKeyPath = $derived(`${keyPath}.${typeKey}`);
  const typeConfig = $derived(
    hasVariableTypes ? types?.find(({ name }) => name === valueMap[typeKeyPath]) : undefined,
  );
  const subFields = $derived((hasVariableTypes ? typeConfig?.fields : fields) ?? []);
  const summaryTemplate = $derived(hasVariableTypes ? typeConfig?.summary || summary : summary);
  const addButtonDisabled = $derived(locale !== defaultLocale && i18n === 'duplicate');

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
      Object.keys($entryDraft?.currentValues ?? {}).forEach((_locale) => {
        if (_locale === locale || i18n === 'duplicate') {
          /** @type {EntryDraft} */ ($entryDraft).currentValues[_locale][typeKeyPath] = type;
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
    formatSummary({ ...getFieldConfigArgs, keyPath, locale, summaryTemplate });

  onMount(() => {
    // Initialize the expander state
    syncExpanderStates({
      [parentExpandedKeyPath]:
        $state.snapshot($entryDraft?.expanderStates?._[parentExpandedKeyPath]) ?? !collapsed,
    });
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
  <div
    role="group"
    class="wrapper"
    aria-labelledby={parentExpanded ? undefined : `object-${widgetId}-summary`}
  >
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
          {@const formattedSummary = _formatSummary()}
          {#if formattedSummary}
            <div role="none" class="summary" id="object-{widgetId}-summary">
              <TruncatedText lines={isSmallScreen ? 2 : 1}>
                {formattedSummary}
              </TruncatedText>
            </div>
          {/if}
        {/if}
      {/await}
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
