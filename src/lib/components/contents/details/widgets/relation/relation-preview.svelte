<!--
  @component
  Implement the preview for the Relation widget.
  @see https://decapcms.org/docs/widgets/#relation
-->
<script>
  import { getOptions } from '$lib/components/contents/details/widgets/relation/helper';
  import { getEntries, getFile } from '$lib/services/contents';

  export let locale = '';
  // svelte-ignore unused-export-let
  export let keyPath = '';
  /** @type {RelationField} */
  export let fieldConfig;
  export let currentValue = undefined;

  $: ({
    // Widget-specific options
    collection: collectionName,
    file: fileName,
    multiple = false,
  } = fieldConfig);

  $: refEntries = fileName ? [getFile(collectionName, fileName)] : getEntries(collectionName);
  $: options = getOptions(locale, fieldConfig, refEntries);

  $: refValues = (
    multiple ? /** @type {string[]} */ (currentValue) : /** @type {string[]} */ ([currentValue])
  )
    .filter((value) => value !== undefined)
    .map((value) => options.find((option) => option.value === value)?.label || value);

  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });
</script>

{#if refValues?.length}
  <p>{listFormatter.format(refValues)}</p>
{/if}
