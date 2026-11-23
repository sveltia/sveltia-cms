<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';

  import SidebarPanel from '$lib/components/contents/details/sidebar/sidebar-panel.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getSidebarPanelLabel, getSidebarPanels } from '$lib/services/contents/editor/sidebar';
  import { needsSlugInput } from '$lib/services/contents/editor/slug';
  import { watch } from '$lib/services/utils/state.svelte';

  const entryDraft = getEntryDraftContext();

  const panels = $derived(getSidebarPanels(entryDraft.current));
  // The panel is remembered in the settings, which can also be updated from elsewhere, e.g. the
  // Show Errors button on the validation toast
  const savedKey = $derived(entryEditorSettings.current?.sidebarPanel ?? null);
  /**
   * Panel opened for the current draft without being remembered: the Slug panel for a new entry
   * whose slug has to be typed in, so the field isn’t missed. `null` shows the remembered panel.
   * @type {string | null}
   */
  let draftPanelKey = $state(null);
  /** @type {string | undefined} */
  let lastDraftId;

  /**
   * The displayed panel, falling back to Validation if the saved panel is unknown, or doesn’t apply
   * to the draft, e.g. History or Conversation for a new entry.
   */
  const activeKey = $derived(
    draftPanelKey ??
      (savedKey
        ? (panels.find((p) => p.key === savedKey && !p.disabled)?.key ?? 'validation')
        : null),
  );

  watch(
    () => [entryDraft.current?.id, savedKey],
    () => {
      const draft = entryDraft.current;

      if (draft?.id !== lastDraftId) {
        lastDraftId = draft?.id;
        draftPanelKey = needsSlugInput(draft) ? 'slug' : null;
      } else {
        // A panel opened elsewhere, e.g. with the Show Errors button, takes over
        draftPanelKey = null;
      }
    },
  );
</script>

<div role="none" class="sidebar">
  <SelectButtonGroup
    class="tabs"
    ariaLabel={_('entry_sidebar.sidebar_panels')}
    aria-controls={activeKey ? 'entry-sidebar-content' : undefined}
  >
    {#each panels as panel (panel.key)}
      {@const { key, icon, disabled, badge } = panel}
      {@const label = getSidebarPanelLabel(panel)}
      <SelectButton
        iconic
        tooltip={label}
        tooltipPosition="left"
        aria-label={label}
        selected={activeKey === key}
        {disabled}
        onclick={() => {
          // Clicking the active tab closes the panel. Read it before the panel opened for the
          // draft is dismissed, as that changes the active tab
          const sidebarPanel = activeKey === key ? null : key;

          draftPanelKey = null;
          entryEditorSettings.current = { ...entryEditorSettings.current, sidebarPanel };
        }}
      >
        <span role="none" class="icon">
          <Icon name={icon} />
          {#if badge}
            <span class="badge" aria-hidden="true">{badge > 99 ? '99+' : badge}</span>
          {/if}
        </span>
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
  .icon {
    position: relative;
    display: inline-flex;
  }

  .badge {
    position: absolute;
    inset-block-start: -6px;
    inset-inline-end: -8px;
    border-radius: 8px;
    padding: 0 4px;
    min-width: 16px;
    height: 16px;
    background-color: var(--sui-primary-accent-color);
    color: var(--sui-primary-accent-color-inverted, #fff);
    font-size: 10px;
    line-height: 16px;
    text-align: center;
    pointer-events: none;
  }

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
