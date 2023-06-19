<script>
  import BooleanPreview from '$lib/components/contents/details/widgets/boolean/boolean-preview.svelte';
  import ColorPreview from '$lib/components/contents/details/widgets/color/color-preview.svelte';
  import DateTimePreview from '$lib/components/contents/details/widgets/date-time/date-time-preview.svelte';
  import FilePreview from '$lib/components/contents/details/widgets/file/file-preview.svelte';
  import ListPreview from '$lib/components/contents/details/widgets/list/list-preview.svelte';
  import MarkdownPreview from '$lib/components/contents/details/widgets/markdown/markdown-preview.svelte';
  import NumberPreview from '$lib/components/contents/details/widgets/number/number-preview.svelte';
  import ObjectPreview from '$lib/components/contents/details/widgets/object/object-preview.svelte';
  import RelationPreview from '$lib/components/contents/details/widgets/relation/relation-preview.svelte';
  import SelectPreview from '$lib/components/contents/details/widgets/select/select-preview.svelte';
  import StringPreview from '$lib/components/contents/details/widgets/string/string-preview.svelte';
  import TextPreview from '$lib/components/contents/details/widgets/text/text-preview.svelte';
  import { entryDraft } from '$lib/services/contents/editor';
  import { escapeRegExp } from '$lib/services/utils/strings';

  export let locale = '';
  export let keyPath = '';
  /**
   * @type {Field}
   */
  export let fieldConfig = undefined;

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

  $: ({
    label = '',
    widget = 'string',
    i18n = false,
    // @ts-ignore
    multiple = false,
  } = fieldConfig);
  $: ({ hasLocales, defaultLocale = 'default' } = $entryDraft.collection._i18n);
  $: canTranslate = hasLocales && (i18n === true || i18n === 'translate');
  $: canDuplicate = hasLocales && i18n === 'duplicate';
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+$`);
  $: isList = widget === 'list' || ((widget === 'relation' || widget === 'select') && multiple);

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

    & > :global(*) {
      margin-right: auto;
      margin-left: auto;
      max-width: 768px;
    }

    h4 {
      color: var(--secondary-foreground-color);
      font-size: var(--font-size--small);

      &:not(:last-child) {
        margin-bottom: 8px;
      }
    }

    :global(p) {
      margin-top: 8px;
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
