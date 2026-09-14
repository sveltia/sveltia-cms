<!--
  @component
  Implement the preview for a String field.
  @see https://decapcms.org/docs/widgets/#String
  @see https://sveltiacms.app/en/docs/fields/string
-->
<script>
  import YouTubeEmbed from '$lib/components/contents/details/fields/string/youtube-embed.svelte';
  import { getPreviewType } from '$lib/services/contents/fields/string/preview';
  import { getCanonicalLocale, getDirection } from '$lib/services/contents/i18n';

  /**
   * @import { FieldPreviewProps } from '$lib/types/private';
   * @import { StringField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {StringField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldPreviewProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldConfig,
    currentValue,
    /* eslint-enable prefer-const */
  } = $props();

  const { name: fieldName } = $derived(fieldConfig);
  /** The value to be shown. Empty if there is no value or it’s whitespace only. */
  const value = $derived(
    typeof currentValue === 'string' && currentValue.trim() ? currentValue : '',
  );
  /* v8 ignore start -- only read while there’s a value */
  const previewType = $derived(value ? getPreviewType({ fieldConfig, value }) : 'text');
  /* v8 ignore stop */
</script>

{#if value}
  <p
    lang={getCanonicalLocale(locale)}
    dir={getDirection(locale)}
    class:title={fieldName === 'title'}
  >
    {#if previewType === 'youtube'}
      <YouTubeEmbed url={value} />
    {:else if previewType === 'link'}
      <a href={encodeURI(value)}>{value}</a>
    {:else if previewType === 'email'}
      <a href="mailto:{encodeURI(value)}">{value}</a>
    {:else}
      {value}
    {/if}
  </p>
{/if}

<style>
  .title {
    font-size: var(--sui-font-size-xxx-large);
    font-weight: var(--sui-font-weight-bold);
  }

  /* Remove the padding to make the iframe full-width on small screens */
  @media (width < 768px) {
    :global([role='document'] section) > p:has(:global(iframe)) {
      margin-inline: calc(var(--entry-preview-padding-inline) * -1);
    }
  }
</style>
