<script>
  import BacklinksPanel from '$lib/components/contents/details/sidebar/panels/backlinks-panel.svelte';
  import HistoryPanel from '$lib/components/contents/details/sidebar/panels/history-panel.svelte';
  import SlugPanel from '$lib/components/contents/details/sidebar/panels/slug-panel.svelte';
  import ValidationPanel from '$lib/components/contents/details/sidebar/panels/validation-panel.svelte';

  /**
   * @import { highlightEditorField } from '$lib/services/contents/editor/fields';
   */

  /**
   * @typedef {object} Props
   * @property {string} key Key of the panel to render. See `getSidebarPanels()`.
   * @property {typeof highlightEditorField} [onSelectField] Called when a field is selected in the
   * Validation panel, instead of highlighting it directly.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    key,
    onSelectField = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

{#if key === 'slug'}
  <SlugPanel />
{:else if key === 'history'}
  <HistoryPanel />
{:else if key === 'backlinks'}
  <BacklinksPanel />
{:else}
  <ValidationPanel {onSelectField} />
{/if}
