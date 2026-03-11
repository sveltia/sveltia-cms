<script>
  import { TruncatedText } from '@sveltia/ui';
  import { stripSlashes } from '@sveltia/utils/string';
  import { sanitize } from 'isomorphic-dompurify';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} [path] The asset path to display.
   * @property {string} [caption] The caption for the asset. Either `path` or `caption` should be
   * provided. The `path` will be split into segments and displayed with line breaks, while the
   * `caption` will be displayed as is without splitting.
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    path,
    caption,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const segments = $derived(path ? stripSlashes(path).split('/') : caption ? [caption] : []);
  const sanitizeOptions = { ALLOWED_TAGS: ['wbr'] };

  /**
   * Get a label with `<wbr>` tags for line breaking after hyphens, underscores, and dots.
   * @param {string} str The string to process.
   * @returns {string} The processed string with `<wbr>` tags for line breaking.
   */
  const getLabel = (str) => sanitize(str.replace(/([-_.])/g, '$1<wbr>'), sanitizeOptions);
</script>

{#if segments.length}
  <!-- Hide the asset path from screen readers because the image comes with alt text -->
  <span class="name" aria-hidden="true">
    <TruncatedText lines={2}>
      {#each segments as segment, index (`${segment}-${index}`)}
        {#if index === segments.length - 1}
          <!-- File name -->
          <strong>{@html getLabel(segment)}</strong>
        {:else}
          <!-- Folder name -->
          {@html getLabel(segment)}/
        {/if}
      {/each}
    </TruncatedText>
    {@render children?.()}
  </span>
{/if}

<style lang="scss">
  .name {
    color: var(--sui-tertiary-foreground-color);

    :global(strong) {
      color: var(--sui-primary-foreground-color);
      font-weight: var(--sui-font-weight-normal);
    }
  }
</style>
