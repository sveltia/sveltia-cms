<!--
  @component
  Implement the preview for the Relation widget.
  @see https://www.netlifycms.org/docs/widgets/#relation
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
  $: listFormatter = new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' });

  $: refValues = (multiple ? currentValue : [currentValue])
    .map((val) => {
      const refEntry = refEntries.find(
        ({ locales }) =>
          flatten(locales[locale]?.content || {})[
            valueField.replace(/(?:{{)?(.+)(?:}})?/, '$1')
          ] === val,
      );

      const content = refEntry ? flatten(refEntry.locales[locale]?.content) : undefined;

      return content
        ? (displayFields || [valueField])
            .map(
              (fieldName) =>
                content[fieldName] ||
                fieldName.replaceAll(/{{(.+?)}}/g, (_match, p1) => content[p1] || '') ||
                '',
            )
            .join(' ')
        : val;
    })
    .filter((val) => val !== undefined);
</script>

{#if refValues?.length}
  <p>{listFormatter.format(refValues)}</p>
{/if}
