<!--
  @component
  Implement the preview for the Relation widget.
  @see https://decapcms.org/docs/widgets/#relation
  @todo Support wildcard matching
-->
<script>
  import { flatten } from 'flat';
  import { getEntries } from '$lib/services/contents';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    collection,
    value_field: valueField,
    display_fields: displayFields,
    multiple = false,
  } = fieldConfig);
  $: refEntries = getEntries(collection);
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });

  $: refValues = (multiple ? currentValue : [currentValue])
    .map((val) => {
      if (val === undefined) {
        return undefined;
      }

      const refEntry = refEntries.find(({ slug, locales }) =>
        valueField === '{{slug}}' || valueField === 'slug'
          ? slug === val
          : flatten(locales[locale]?.content || {})[
              valueField.replace(/(?:{{)?(.+)(?:}})?/, '$1')
            ] === val,
      );

      const content = refEntry ? flatten(refEntry.locales[locale]?.content) : undefined;

      if (!content) {
        return val;
      }

      return (displayFields || [valueField])
        .map(
          (fieldName) =>
            content[fieldName] ||
            fieldName.replaceAll(/{{(.+?)}}/g, (_match, p1) => content[p1] || '') ||
            '',
        )
        .join(' ');
    })
    .filter((val) => val !== undefined)
    .sort((a, b) => a.localeCompare(b));
</script>

{#if refValues?.length}
  <p>{listFormatter.format(refValues)}</p>
{/if}
