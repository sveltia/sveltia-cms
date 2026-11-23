<script>
  import BacklinksPanel from '$lib/components/contents/details/sidebar/panels/backlinks-panel.svelte';
  import HistoryPanel from '$lib/components/contents/details/sidebar/panels/history-panel.svelte';
  import SlugPanel from '$lib/components/contents/details/sidebar/panels/slug-panel.svelte';
  import ValidationPanel from '$lib/components/contents/details/sidebar/panels/validation-panel.svelte';
  import { requireAdditions } from '$lib/services/app/additions';

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
  let { key, onSelectField = undefined } = $props();

  // The Conversation panel is only offered with Sveltia CMS Additions, whose chunk is loaded along
  // with the backend, so it’s there whenever the panel is
  const additions = $derived(requireAdditions());
</script>

{#if key === 'slug'}
  <SlugPanel />
{:else if key === 'history'}
  <HistoryPanel />
{:else if key === 'backlinks'}
  <BacklinksPanel />
{:else if key === 'conversation'}
  <additions.ConversationPanel />
{:else}
  <ValidationPanel {onSelectField} />
{/if}
