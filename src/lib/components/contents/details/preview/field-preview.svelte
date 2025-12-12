<script>
  import { escapeRegExp } from '@sveltia/utils/string';

  import { previews } from '$lib/components/contents/details/widgets';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getExpanderKeys, syncExpanderStates } from '$lib/services/contents/editor/expanders';
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
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    typedKeyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const { name: fieldName, widget: fieldType = 'string', i18n = false } = $derived(fieldConfig);
  const { label = '', preview = true } = $derived(/** @type {VisibleField} */ (fieldConfig));
  const multiple = $derived(isFieldMultiple(fieldConfig));
  const isList = $derived(fieldType === 'list' || multiple);
  const isIndexFile = $derived($entryDraft?.isIndexFile ?? false);
  const collection = $derived($entryDraft?.collection);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const collectionFile = $derived($entryDraft?.collectionFile);
  const fileName = $derived($entryDraft?.fileName);
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale] ?? {}));
  const expanderKeys = $derived(
    getExpanderKeys({ collectionName, fileName, valueMap, keyPath, isIndexFile }),
  );
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
   * Called whenever the preview field is clicked. Highlight the corresponding editor field by
   * expanding the parent list/object(s), moving the element into the viewport, and focus any
   * control within the field, such as a text input or button.
   */
  const highlightEditorField = () => {
    syncExpanderStates(Object.fromEntries(expanderKeys.map((key) => [key, true])));

    window.requestAnimationFrame(() => {
      const targetField = document.querySelector(
        `.content-editor .pane[data-mode="edit"] .field[data-key-path="${CSS.escape(keyPath)}"]`,
      );

      if (targetField) {
        if (typeof targetField.scrollIntoViewIfNeeded === 'function') {
          targetField.scrollIntoViewIfNeeded();
        } else {
          targetField.scrollIntoView();
        }

        const widgetWrapper = targetField.querySelector('.field-wrapper');

        /** @type {HTMLElement | null} */ (
          widgetWrapper?.querySelector('[contenteditable="true"], [tabindex="0"]') ??
            widgetWrapper?.querySelector('input, textarea, button')
        )?.focus();
      }
    });
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
    <h4>{label || fieldName}</h4>
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
