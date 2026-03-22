<script>
  import { escapeRegExp } from '@sveltia/utils/string';

  import { previews } from '$lib/components/contents/details/fields';
  import { entryDraft } from '$lib/services/contents/draft';
  import { isFieldMultiple } from '$lib/services/contents/entry/fields';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

  /**
   * @import { InternalLocaleCode, TypedFieldKeyPath } from '$lib/types/private';
   * @import { Field, FieldKeyPath, VisibleField } from '$lib/types/public';
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
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale] ?? {}));
  const { i18nEnabled, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const canTranslate = $derived(i18nEnabled && (i18n === true || i18n === 'translate'));
  const canDuplicate = $derived(i18nEnabled && i18n === 'duplicate');
  const keyPathRegex = $derived(new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`));
  // Multiple values are flattened in the value map object
  const currentValue = $derived(
    isList
      ? Object.entries(valueMap)
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([, val]) => val)
          .filter((val) => val !== undefined)
      : valueMap[keyPath],
  );

  /**
   * Called whenever the preview field is clicked. Posts a message to the window to highlight the
   * corresponding field in the editor.
   */
  const highlightEditorField = () => {
    window.postMessage({ type: 'highlight-editor-field', payload: { locale, keyPath } });
  };
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
        highlightEditorField();
      }
    }}
    onclick={(event) => {
      event.stopPropagation();
      highlightEditorField();
    }}
  >
    {#if showLabel}
      <h4>{label || fieldName}</h4>
    {/if}
    {#if fieldType in previews}
      {@const Preview = previews[fieldType]}
      <Preview {keyPath} {typedKeyPath} {locale} {fieldConfig} {currentValue} />
    {/if}
  </section>
{/if}

<style lang="scss">
  :global([role='document']) section {
    overflow: hidden;
    margin: 8px 0;
    padding: 8px 0;

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
