<!--
  @component
  Implement the preview for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { waitForVisibility } from '@sveltia/utils/element';
  import { sleep } from '@sveltia/utils/misc';
  import { escapeRegExp } from '@sveltia/utils/string';
  import { unflatten } from 'flat';
  import { getListFormatter } from '$lib/services/contents/i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath;
  /**
   * @type {ListField}
   */
  export let fieldConfig;
  /**
   * @type {string[]}
   */
  export let currentValue;

  /** @type {HTMLElement[]} */
  const wrappers = [];

  $: ({
    name: fieldName,
    // Widget-specific options
    field,
    fields,
    types,
    typeKey = 'type',
  } = fieldConfig);
  $: hasSubFields = !!(field ?? fields ?? types);
  $: keyPathRegex = new RegExp(`^${escapeRegExp(keyPath)}\\.\\d+`);
  $: listFormatter = getListFormatter(locale);

  $: items =
    unflatten(
      Object.fromEntries(
        Object.entries($entryDraft?.currentValues[locale] ?? {})
          .filter(([_keyPath]) => keyPathRegex.test(_keyPath))
          .map(([_keyPath, value]) => [
            _keyPath.replace(new RegExp(`^${escapeRegExp(keyPath)}`), fieldName),
            value,
          ]),
      ),
    )[fieldName] ?? [];
</script>

{#if hasSubFields}
  <!-- eslint-disable-next-line no-unused-vars -->
  {#each items as item, index}
    {@const subFieldName = Array.isArray(types)
      ? $entryDraft?.currentValues[locale][`${keyPath}.${index}.${typeKey}`]
      : undefined}
    {@const subFields = subFieldName
      ? (types?.find(({ name }) => name === subFieldName)?.fields ?? [])
      : (fields ?? (field ? [field] : []))}
    <section class="subsection" bind:this={wrappers[index]}>
      {#await waitForVisibility(wrappers[index]) then}
        {#each subFields as subField (subField.name)}
          {#await sleep(0) then}
            <FieldPreview
              keyPath={field ? `${keyPath}.${index}` : `${keyPath}.${index}.${subField.name}`}
              {locale}
              fieldConfig={subField}
            />
          {/await}
        {/each}
      {/await}
    </section>
  {/each}
{:else if Array.isArray(currentValue) && currentValue.length}
  <p lang={locale} dir="auto">{listFormatter.format(currentValue)}</p>
{/if}
