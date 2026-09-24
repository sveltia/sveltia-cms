<!--
  @component
  Bottom sheet that shows an entry editor sidebar panel on a small screen, where the sidebar doesn’t
  fit. It’s opened from the editor options menu or the validation toast.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Drawer } from '@sveltia/ui';
  import { onMount } from 'svelte';

  import SidebarPanel from '$lib/components/contents/details/sidebar/sidebar-panel.svelte';
  import { highlightEditorField } from '$lib/services/contents/editor/fields';
  import { sidebarSheetPanel } from '$lib/services/contents/editor/sidebar';

  /**
   * @import { InternalLocaleCode } from '$lib/types/private';
   * @import { FieldKeyPath } from '$lib/types/public';
   */

  /**
   * Panel shown while the sheet slides away, or `null` if it’s not closing. The request is cleared
   * as soon as the sheet starts closing, so a panel requested again meanwhile, even the same one,
   * reopens the sheet once it’s closed, but the content stays until then.
   * @type {string | null}
   */
  let closingKey = $state(null);
  /**
   * Field to highlight once the sheet is closed. The rest of the page is inert while the sheet is
   * open, so the field can’t be focused before then.
   * @type {{ locale: InternalLocaleCode, keyPath: FieldKeyPath } | undefined}
   */
  let fieldToHighlight;

  const key = $derived(closingKey ?? sidebarSheetPanel.current);
  const open = $derived(!!sidebarSheetPanel.current && !closingKey);

  /**
   * Start closing the sheet.
   */
  const close = () => {
    closingKey = sidebarSheetPanel.current;
    sidebarSheetPanel.current = null;
  };

  onMount(() => () => {
    // The editor can go away with the sheet open, e.g. when a backlink is followed or the browser
    // goes back, and the next editor shouldn’t open with the sheet
    sidebarSheetPanel.current = null;
  });
</script>

<Drawer
  // The drawer only writes the flag back when it closes itself
  bind:open={() => open, close}
  class="entry-sidebar-sheet"
  position="bottom"
  size="medium"
  title={key ? _(`entry_sidebar.${key}.title`) : ''}
  onClose={() => {
    closingKey = null;

    // Unless another panel has been requested in the meantime, which reopens the sheet
    if (fieldToHighlight && !sidebarSheetPanel.current) {
      highlightEditorField(fieldToHighlight);
    }

    fieldToHighlight = undefined;
  }}
>
  <!-- The panel has a header of its own, with the title and controls; the title above still names
    the sheet -->
  {#snippet header()}{/snippet}
  {#if key}
    <SidebarPanel
      {key}
      onSelectField={(target) => {
        fieldToHighlight = target;
        close();
      }}
    />
  {/if}
</Drawer>

<style>
  :global {
    .entry-sidebar-sheet {
      --sui-drawer-bottom-content-border-start-start-radius: 16px;
      --sui-drawer-bottom-content-border-start-end-radius: 16px;
      /* The panel scrolls its own content below the header */
      --sui-drawer-main-padding: 0;
    }
  }
</style>
