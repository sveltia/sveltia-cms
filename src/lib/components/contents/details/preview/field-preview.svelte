<script>
  import ErrorBoundary from '$lib/components/common/error-boundary.svelte';
  import { CustomPreview, previews } from '$lib/components/contents/details/fields';
  import { customFieldTypeRegistry } from '$lib/services/api/registries';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { getFieldValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { highlightEditorField } from '$lib/services/contents/editor/fields';
  import { getFieldLocaleAccess } from '$lib/services/contents/editor/locale';
  import { getCurrentValue, isFieldMultiple } from '$lib/services/contents/entry/fields';

  /**
   * @import { InternalLocaleCode, TypedFieldKeyPath } from '$lib/types/private';
   * @import { CustomField, Field, FieldKeyPath, VisibleField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Field key path.
   * @property {TypedFieldKeyPath} typedKeyPath Typed field key path.
   * @property {Field} fieldConfig Field configuration.
   * @property {boolean} [showLabel] Whether to show the field label/header. Defaults to `true`.
   */

  const entryDraft = getEntryDraftContext();

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    showLabel = true,
    /* eslint-enable prefer-const */
  } = $props();

  const { name: fieldName, widget: fieldType = 'string' } = $derived(fieldConfig);
  const { label = '', preview = true } = $derived(/** @type {VisibleField} */ (fieldConfig));
  const multiple = $derived(isFieldMultiple(fieldConfig));
  const isList = $derived(fieldType === 'list' || multiple);
  const valueMap = $derived(getFieldValueMapSnapshot(entryDraft.current, locale, keyPath));
  // A field duplicated along with an ancestor is shown in the other locales like in `FieldEditor`
  const { isShown } = $derived(
    getFieldLocaleAccess({ draft: entryDraft.current, fieldConfig, keyPath, locale, valueMap }),
  );
  const customFieldType = $derived(customFieldTypeRegistry.get(fieldType));
  const currentValue = $derived(
    getCurrentValue({ valueMap, keyPath, isList, isCustomFieldType: !!customFieldType }),
  );
  const previewProps = $derived({ locale, keyPath, typedKeyPath, fieldConfig, currentValue });
</script>

<!-- Render nothing for a missing field configuration, e.g. when a custom preview template asks
  for a key path that isn’t a configured field. The derived values above are read past the check -->
{#if fieldConfig && fieldType !== 'hidden' && preview && isShown}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section
    role="group"
    data-field-type={fieldType}
    data-key-path={keyPath}
    data-typed-key-path={typedKeyPath}
    tabindex="0"
    onkeydown={(event) => {
      if (event.key === 'Enter') {
        event.stopPropagation();
        highlightEditorField({ locale, keyPath });
      }
    }}
    onclick={(event) => {
      event.stopPropagation();
      highlightEditorField({ locale, keyPath });
    }}
  >
    {#if showLabel}
      <h4>{label || fieldName}</h4>
    {/if}
    <ErrorBoundary>
      {#if customFieldType?.preview}
        <CustomPreview
          {...{ ...previewProps, fieldConfig: /** @type {CustomField} */ (fieldConfig) }}
          preview={customFieldType.preview}
        />
      {:else if fieldType in previews}
        {@const Preview = previews[fieldType]}
        <Preview {...previewProps} />
      {/if}
    </ErrorBoundary>
  </section>
{/if}

<style>
  :global([role='document']) section {
    overflow: hidden;
    /* Don’t set margin here because it makes scroll sync bumpy */
    padding: 12px 0;

    h4 {
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);

      &:not(:last-child) {
        margin-bottom: 8px;
      }
    }

    :global {
      & > * {
        margin-inline: auto;
        max-width: 768px;
      }

      p {
        margin: 8px auto 0;
        -webkit-user-select: text;
        user-select: text;
      }

      img {
        max-height: 800px !important;
      }

      .sui.alert {
        margin-block: 16px;
      }
    }
  }

  @media (width < 768px) {
    /* A top-level field, which is wrapped for the Edit Pane to find it before it’s rendered */
    :global([role='document'] > [data-lazy-key-path]) {
      & > section:is([data-field-type='file'], [data-field-type='image']):has(:global(img)),
      & > section:is([data-field-type='string']):has(:global(iframe)) {
        overflow: visible;
      }

      & > section:is([data-field-type='file'], [data-field-type='image']) :global(img) {
        width: 100%;
        max-height: none !important;
      }
    }
  }
</style>
