<script>
  import BooleanPreview from '$lib/components/contents/details/preview/widgets/boolean-preview.svelte';
  import ColorPreview from '$lib/components/contents/details/preview/widgets/color-preview.svelte';
  import DateTimePreview from '$lib/components/contents/details/preview/widgets/date-time-preview.svelte';
  import FilePreview from '$lib/components/contents/details/preview/widgets/file-preview.svelte';
  import ListPreview from '$lib/components/contents/details/preview/widgets/list-preview.svelte';
  import MarkdownPreview from '$lib/components/contents/details/preview/widgets/markdown-preview.svelte';
  import NumberPreview from '$lib/components/contents/details/preview/widgets/number-preview.svelte';
  import ObjectPreview from '$lib/components/contents/details/preview/widgets/object-preview.svelte';
  import RelationPreview from '$lib/components/contents/details/preview/widgets/relation-preview.svelte';
  import SelectPreview from '$lib/components/contents/details/preview/widgets/select-preview.svelte';
  import StringPreview from '$lib/components/contents/details/preview/widgets/string-preview.svelte';
  import TextPreview from '$lib/components/contents/details/preview/widgets/text-preview.svelte';
  import { entryDraft } from '$lib/services/contents/editor';
  import { escapeRegExp } from '$lib/services/utils/strings';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};

  const widgets = {
    boolean: BooleanPreview,
    color: ColorPreview,
    date: DateTimePreview, // alias
    datetime: DateTimePreview,
    file: FilePreview,
    image: FilePreview, // alias
    list: ListPreview,
    markdown: MarkdownPreview,
    number: NumberPreview,
    object: ObjectPreview,
    relation: RelationPreview,
    select: SelectPreview,
    string: StringPreview,
    text: TextPreview,
  };

  $: ({ label = '', widget = 'string', i18n = false, multiple = false } = fieldConfig);
  $: ({ hasLocales, defaultLocale = 'default' } = $entryDraft.collection._i18n);
  $: canTranslate = hasLocales && (i18n === true || i18n === 'translate');
  $: canDuplicate = hasLocales && i18n === 'duplicate';
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);
  $: isList = multiple || widget === 'list';

  // Multiple values are flattened in the value map object
  $: currentValue = isList
    ? Object.entries($entryDraft.currentValues[locale])
        .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
        .map(([, val]) => val)
        .filter((val) => val !== undefined)
    : $entryDraft.currentValues[locale][keyPath];
</script>

{#if widget !== 'hidden' && (locale === defaultLocale || canTranslate || canDuplicate)}
  <section data-widget={widget} data-key-path={keyPath}>
    <h4>{label}</h4>
    {#if widget in widgets}
      <svelte:component this={widgets[widget]} {keyPath} {locale} {fieldConfig} {currentValue} />
    {/if}
  </section>
{/if}

<style lang="scss">
  section {
    overflow: hidden;
    padding: 8px 0;

    h4 {
      color: var(--secondary-foreground-color);
      font-size: var(--font-size--small);

      &:not(:last-child) {
        margin: 0 0 8px;
      }
    }

    :global(p) {
      margin: 8px 0 0;
    }

    :global(img) {
      max-width: 100%;
    }

    :global(.subsection) {
      border-width: 2px 2px 0;
      border-style: solid;
      border-color: var(--secondary-border-color);
      padding: 8px 16px;

      :global(.title) {
        font-size: inherit;
        font-weight: normal;
      }
    }

    :global(.subsection:first-of-type) {
      border-top-right-radius: var(--control--medium--border-radius);
      border-top-left-radius: var(--control--medium--border-radius);
    }

    :global(.subsection:last-of-type) {
      border-bottom: 2px solid var(--secondary-border-color);
      border-bottom-right-radius: var(--control--medium--border-radius);
      border-bottom-left-radius: var(--control--medium--border-radius);
    }
  }
</style>
