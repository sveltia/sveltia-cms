<script>
  import { previews } from '$lib/components/contents/details/widgets';
  import { entryDraft } from '$lib/services/contents/editor';
  import { defaultI18nConfig } from '$lib/services/contents/i18n';
  import { escapeRegExp } from '$lib/services/utils/strings';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {string}
   */
  export let keyPath;
  /**
   * @type {Field}
   */
  export let fieldConfig;

  $: ({ name: fieldName, label = '', widget: widgetName = 'string', i18n = false } = fieldConfig);
  $: hasMultiple = ['relation', 'select'].includes(widgetName);
  $: multiple = hasMultiple
    ? /** @type {RelationField | SelectField} */ (fieldConfig).multiple
    : undefined;
  $: isList = widgetName === 'list' || (hasMultiple && multiple);
  $: ({ collection, collectionFile, currentValues } = $entryDraft);
  $: ({ i18nEnabled, defaultLocale } = (collectionFile ?? collection)?._i18n ?? defaultI18nConfig);
  $: canTranslate = i18nEnabled && (i18n === true || i18n === 'translate');
  $: canDuplicate = i18nEnabled && i18n === 'duplicate';
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);

  // Multiple values are flattened in the value map object
  $: currentValue = isList
    ? Object.entries(currentValues[locale])
        .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : currentValues[locale][keyPath];
</script>

{#if widgetName !== 'hidden' && (locale === defaultLocale || canTranslate || canDuplicate)}
  <section data-widget={widgetName} data-key-path={keyPath}>
    <h4>{label || fieldName}</h4>
    {#if widgetName in previews}
      <svelte:component
        this={previews[widgetName]}
        {keyPath}
        {locale}
        {fieldConfig}
        {currentValue}
      />
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
        font-weight: normal;
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
