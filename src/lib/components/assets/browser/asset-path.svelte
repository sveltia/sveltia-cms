<script>
  import { TruncatedText } from '@sveltia/ui';
  import { stripSlashes } from '@sveltia/utils/string';
  import { sanitize } from 'isomorphic-dompurify';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string} path The asset path to display. It can be an empty string if no path is
   * available (Lorem Picsum doesn’t provide image captions).
   * @property {Snippet} [children] Slot content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    path,
    children = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const pathArray = $derived(path ? stripSlashes(path).split('/') : []);
  const sanitizeOptions = { ALLOWED_TAGS: ['wbr'] };

  /**
   * Get a label with `<wbr>` tags for line breaking after hyphens, underscores, and dots.
   * @param {string} str The string to process.
   * @returns {string} The processed string with `<wbr>` tags for line breaking.
   */
  const getLabel = (str) => sanitize(str.replace(/([-_.])/g, '$1<wbr>'), sanitizeOptions);
</script>

{#if pathArray.length}
  <span role="none" class="name">
    <TruncatedText lines={2}>
      {#each pathArray as segment, index (`${segment}-${index}`)}
        {#if index === pathArray.length - 1}
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
