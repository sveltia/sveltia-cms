<!--
  @component
  Implement the preview for the List widget.
  @see https://www.netlifycms.org/docs/widgets/#list
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

  $: ({ name: fieldName, fields, field } = fieldConfig);
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`);
  $: listFormatter = new Intl.ListFormat(locale, { style: 'short', type: 'conjunction' });

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

{#if fields || field}
  {#each items as item, index}
    <section class="subsection">
      {#each fields || [field] as subField (subField.name)}
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
