<!--
  @component
  Implement the preview for the String widget.
  @see https://decapcms.org/docs/widgets/#string
-->
<script>
  import { isURL } from '@sveltia/utils/string';
  import YouTubeEmbed from '$lib/components/contents/details/widgets/string/youtube-embed.svelte';
  import { isYouTubeVideoURL } from '$lib/services/utils/media';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {FieldKeyPath}
   */
  // svelte-ignore unused-export-let
  export let keyPath;
  /**
   * @type {StringField}
   */
  export let fieldConfig;
  /**
   * @type {string}
   */
  export let currentValue;

  $: ({
    name: fieldName,
    // Widget-specific options
    type = 'text',
  } = fieldConfig);
</script>

{#if typeof currentValue === 'string' && currentValue.trim()}
  <p lang={locale} dir="auto" class:title={fieldName === 'title'}>
    {#if type === 'url' || isURL(currentValue)}
      {#if isYouTubeVideoURL(currentValue)}
        <YouTubeEmbed url={currentValue} />
      {:else}
        <a href={encodeURI(currentValue)}>{currentValue}</a>
      {/if}
    {:else if type === 'email'}
      <a href="mailto:{encodeURI(currentValue)}">{currentValue}</a>
    {:else}
      {currentValue}
    {/if}
  </p>
{/if}

<style lang="scss">
  .title {
    font-size: var(--sui-font-size-xxx-large);
    font-weight: var(--sui-font-weight-bold);
  }
</style>
