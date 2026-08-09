<script>
  import { CustomPreview, previews } from '$lib/components/contents/details/fields';
  import { customFieldTypeRegistry } from '$lib/services/api/registries';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { highlightEditorField } from '$lib/services/contents/editor/fields';
  import { getCurrentValue, isFieldMultiple } from '$lib/services/contents/entry/fields';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

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

  const { name: fieldName, widget: fieldType = 'string', i18n = false } = $derived(fieldConfig);
  const { label = '', preview = true } = $derived(/** @type {VisibleField} */ (fieldConfig));
  const multiple = $derived(isFieldMultiple(fieldConfig));
  const isList = $derived(fieldType === 'list' || multiple);
  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const valueMap = $derived(getValueMapSnapshot($entryDraft, locale));
  const { i18nEnabled, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const canTranslate = $derived(i18nEnabled && (i18n === true || i18n === 'translate'));
  const canDuplicate = $derived(i18nEnabled && i18n === 'duplicate');
  const customFieldType = $derived(customFieldTypeRegistry.get(fieldType));
  const currentValue = $derived(
    getCurrentValue({
      valueMap,
      keyPath,
      isList,
      multiple,
      isEditor: false,
      isCustomFieldType: !!customFieldType,
    }),
  );
  const previewProps = $derived({ locale, keyPath, typedKeyPath, fieldConfig, currentValue });
</script>

{#if fieldType !== 'hidden' && preview && (locale === defaultLocale || canTranslate || canDuplicate)}
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
    {#if customFieldType?.preview}
      <CustomPreview
        {...{ ...previewProps, fieldConfig: /** @type {CustomField} */ (fieldConfig) }}
        preview={customFieldType.preview}
      />
    {:else if fieldType in previews}
      {@const Preview = previews[fieldType]}
      <Preview {...previewProps} />
    {/if}
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
    :global([role='document']) {
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
