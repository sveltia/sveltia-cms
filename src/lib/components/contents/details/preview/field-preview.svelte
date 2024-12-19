<script>
  import { escapeRegExp } from '@sveltia/utils/string';
  import { previews } from '$lib/components/contents/details/widgets';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getExpanderKeys, syncExpanderStates } from '$lib/services/contents/draft/editor';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {Field}
   */
  export let fieldConfig;

  $: ({
    name: fieldName,
    label = '',
    widget: widgetName = 'string',
    preview = true,
    i18n = false,
  } = fieldConfig);
  $: hasMultiple = ['relation', 'select'].includes(widgetName);
  $: multiple = hasMultiple
    ? /** @type {RelationField | SelectField} */ (fieldConfig).multiple
    : undefined;
  $: isList = widgetName === 'list' || (hasMultiple && multiple);
  $: ({ collectionName, fileName, collection, collectionFile, currentValues } =
    $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: valueMap = currentValues[locale];
  $: ({ i18nEnabled, defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: canTranslate = i18nEnabled && (i18n === true || i18n === 'translate');
  $: canDuplicate = i18nEnabled && i18n === 'duplicate';
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);

  // Multiple values are flattened in the value map object
  $: currentValue = isList
    ? Object.entries(valueMap)
        .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : valueMap[keyPath];

  /**
   * Called whenever the preview field is clicked. Highlight the corresponding editor field by
   * expanding the parent list/object(s), moving the element into the viewport, and blinking it.
   */
  const highlightEditorField = () => {
    syncExpanderStates(
      Object.fromEntries(
        getExpanderKeys({ collectionName, fileName, valueMap, keyPath }).map((key) => [key, true]),
      ),
    );

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

        targetField.classList.add('highlight');

        window.setTimeout(() => {
          targetField.classList.remove('highlight');
        }, 1500);
      }
    });
  };
</script>

{#if widgetName !== 'hidden' && preview && (locale === defaultLocale || canTranslate || canDuplicate)}
  <!-- svelte-ignore a11y-no-noninteractive-tabindex -->
  <!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
  <section
    role="group"
    data-widget={widgetName}
    data-key-path={keyPath}
    tabindex="0"
    on:keydown={(event) => {
      if (event.key === 'Enter') {
        event.stopPropagation();
        highlightEditorField();
      }
    }}
    on:click={(event) => {
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

    :global(.subsection) {
      border-width: 2px 2px 0;
      border-style: solid;
      border-color: var(--sui-secondary-border-color);
      padding: 8px 16px;

      :global(.title) {
        font-size: inherit;
        font-weight: var(--sui-font-weight-normal);
      }
    }

    :global(.subsection:first-of-type) {
      border-top-right-radius: var(--sui-control-medium-border-radius);
      border-top-left-radius: var(--sui-control-medium-border-radius);
    }

    :global(.subsection:last-of-type) {
      border-bottom: 2px solid var(--sui-secondary-border-color);
      border-bottom-right-radius: var(--sui-control-medium-border-radius);
      border-bottom-left-radius: var(--sui-control-medium-border-radius);
    }
  }
</style>
