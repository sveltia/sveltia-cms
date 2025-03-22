<script>
  import { escapeRegExp } from '@sveltia/utils/string';
  import { previews } from '$lib/components/contents/details/widgets';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getExpanderKeys, syncExpanderStates } from '$lib/services/contents/draft/editor';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { Field, FieldKeyPath, RelationField, SelectField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {FieldKeyPath} keyPath Field key path.
   * @property {Field} fieldConfig Field configuration.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldConfig,
    /* eslint-enable prefer-const */
  } = $props();

  const {
    name: fieldName,
    label = '',
    widget: widgetName = 'string',
    preview = true,
    i18n = false,
  } = $derived(fieldConfig);
  const hasMultiple = $derived(['relation', 'select'].includes(widgetName));
  const multiple = $derived(
    hasMultiple ? /** @type {RelationField | SelectField} */ (fieldConfig).multiple : undefined,
  );
  const isList = $derived(widgetName === 'list' || (hasMultiple && multiple));
  const collection = $derived($entryDraft?.collection);
  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const collectionFile = $derived($entryDraft?.collectionFile);
  const fileName = $derived($entryDraft?.fileName);
  const valueMap = $derived($state.snapshot($entryDraft?.currentValues[locale] ?? {}));
  const expanderKeys = $derived(getExpanderKeys({ collectionName, fileName, valueMap, keyPath }));
  const { i18nEnabled, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? defaultI18nConfig,
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

        const widgetWrapper = targetField.querySelector('.widget-wrapper');

        /** @type {HTMLElement | null} */ (
          widgetWrapper?.querySelector('[contenteditable="true"], [tabindex="0"]') ??
            widgetWrapper?.querySelector('input, textarea, button')
        )?.focus();
      }
    });
  };
</script>

{#if widgetName !== 'hidden' && preview && (locale === defaultLocale || canTranslate || canDuplicate)}
  <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
  <!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
  <section
    role="group"
    data-widget={widgetName}
    data-key-path={keyPath}
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
    {#if widgetName in previews}
      {@const Preview = previews[widgetName]}
      <Preview {keyPath} {locale} {fieldConfig} {currentValue} />
    {/if}
  </section>
{/if}

<style lang="scss">
  section {
    overflow: hidden;
    margin: 8px 0;
    padding: 8px 0;

    & > :global(*) {
      margin-right: auto;
      margin-left: auto;
      max-width: 768px;
    }

    h4 {
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);

      &:not(:last-child) {
        margin-bottom: 8px;
      }
    }

    :global(p) {
      margin: 8px auto 0;
      -webkit-user-select: text;
      user-select: text;
    }

    :global(img) {
      max-height: 800px !important;
    }
  }
</style>
