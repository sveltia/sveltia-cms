<!--
  @component
  Implement the preview for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { unflatten } from 'flat';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/editor';
  import { escapeRegExp } from '$lib/services/utils/strings';

  export let locale = '';
  export let keyPath = '';
  export let fieldConfig = {};
  export let currentValue = undefined;

  $: ({
    name: fieldName,
    // Widget-specific options
    field,
    fields,
    types,
    typeKey = 'type',
  } = fieldConfig);
  $: hasSubFields = !!(field || fields || types);
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`);
  $: listFormatter = new Intl.ListFormat(locale, { style: 'narrow', type: 'conjunction' });

  $: items =
    unflatten(
      Object.fromEntries(
        Object.entries($entryDraft.currentValues[locale])
          .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
          .map(([_keyPath, value]) => [
            _keyPath.replace(new RegExp(`^${escapeRegExp(keyPath)}`), fieldName),
            value,
          ]),
      ),
    )[fieldName] || [];
</script>

{#if hasSubFields}
  <!-- eslint-disable-next-line no-unused-vars -->
  {#each items as item, index}
    {@const subFieldName = Array.isArray(types)
      ? $entryDraft.currentValues[locale][`${keyPath}.${index}.${typeKey}`]
      : undefined}
    {@const subFields = subFieldName
      ? types.find(({ name }) => name === subFieldName)?.fields || []
      : fields || [field]}
    <section class="subsection">
      {#each subFields as subField (subField.name)}
        <FieldPreview
          keyPath={[keyPath, index, subField.name].join('.')}
          {locale}
          fieldConfig={subField}
        />
      {/each}
    </section>
  {/each}
{:else if Array.isArray(currentValue) && currentValue.length}
  <p>{listFormatter.format(currentValue)}</p>
{/if}
