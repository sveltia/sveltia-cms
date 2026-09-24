<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import SidebarPanel from '$lib/components/contents/details/sidebar/sidebar-panel.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getSidebarPanels } from '$lib/services/contents/editor/sidebar';

  const entryDraft = getEntryDraftContext();

  const panels = $derived(getSidebarPanels(entryDraft.current));
  // The panel is remembered in the settings, which can also be updated from elsewhere, e.g. the
  // Show Errors button on the validation toast
  const savedKey = $derived(entryEditorSettings.current?.sidebarPanel ?? null);
  /** The displayed panel, falling back to Validation if the saved panel is unknown. */
  const activeKey = $derived(
    savedKey ? (panels.find((p) => p.key === savedKey) ?? panels[0]).key : null,
  );
</script>

<div role="none" class="sidebar">
  <SelectButtonGroup
    class="tabs"
    ariaLabel={_('entry_sidebar.sidebar_panels')}
    aria-controls={activeKey ? 'entry-sidebar-content' : undefined}
  >
    {#each panels as { key, icon, disabled } (key)}
      <SelectButton
        iconic
        aria-label={_(`entry_sidebar.${key}.title`)}
        selected={activeKey === key}
        {disabled}
        onclick={() => {
          entryEditorSettings.current = {
            ...entryEditorSettings.current,
            // Clicking the active tab closes the panel
            sidebarPanel: activeKey === key ? null : key,
          };
        }}
      >
        <Icon name={icon} />
      </SelectButton>
    {/each}
  </SelectButtonGroup>
  {#if activeKey}
    <div role="none" class="content" id="entry-sidebar-content">
      <SidebarPanel key={activeKey} />
    </div>
  {/if}
</div>

<style>
  .sidebar {
    flex: none;
    display: flex;
    flex-direction: row-reverse;

    :global {
      .tabs {
        flex: none;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
        margin: 0;
        padding: 8px 0;
        width: 48px;

        button {
          border-radius: 4px !important;
        }
      }
    }
  }

  .content {
    flex: none;
    width: 320px;
    margin-inline-start: 8px;
    border: var(--area-border);
    border-block-end: 0;
    border-radius: 16px 16px 0 0;
    background-color: var(--sui-primary-background-color);
  }
</style>
