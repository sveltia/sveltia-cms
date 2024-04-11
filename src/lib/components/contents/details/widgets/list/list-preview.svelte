<!--
  @component
  Implement the preview for the List widget.
  @see https://decapcms.org/docs/widgets/#list
-->
<script>
  import { unflatten } from 'flat';
  import FieldPreview from '$lib/components/contents/details/preview/field-preview.svelte';
  import { entryDraft } from '$lib/services/contents/editor';
  import { getCanonicalLocale } from '$lib/services/contents/i18n';
  import { waitForVisibility } from '$lib/services/utils/misc';
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
  $: canonicalLocale = getCanonicalLocale(locale);
  $: listFormatter = new Intl.ListFormat(canonicalLocale, { style: 'narrow', type: 'conjunction' });

  $: items =
    unflatten(
      Object.fromEntries(
        Object.entries($entryDraft?.currentValues[locale] ?? {})
          .filter(([_keyPath]) => _keyPath.match(keyPathRegex))
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
      ? types?.find(({ name }) => name === subFieldName)?.fields ?? []
      : fields ?? (field ? [field] : [])}
    <section class="subsection" bind:this={wrappers[index]}>
      {#await !!wrappers[index] && waitForVisibility(wrappers[index]) then}
        {#each subFields as subField (subField.name)}
          <FieldPreview
            keyPath={field ? `${keyPath}.${index}` : `${keyPath}.${index}.${subField.name}`}
            {locale}
            fieldConfig={subField}
          />
        {/each}
      {/await}
    </section>
  {/each}
{:else if Array.isArray(currentValue) && currentValue.length}
  <p>{listFormatter.format(currentValue)}</p>
{/if}
