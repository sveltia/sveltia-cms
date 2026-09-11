<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, SelectButton, SelectButtonGroup } from '@sveltia/ui';
  import { untrack } from 'svelte';

  import BacklinksPanel from '$lib/components/contents/details/sidebar/panels/backlinks-panel.svelte';
  import HistoryPanel from '$lib/components/contents/details/sidebar/panels/history-panel.svelte';
  import ValidationPanel from '$lib/components/contents/details/sidebar/panels/validation-panel.svelte';
  import { backend } from '$lib/services/backends';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { entryEditorSettings } from '$lib/services/contents/editor/settings';
  import { getReferencingRelationFields } from '$lib/services/contents/entry/relations';

  /**
   * @import { Component } from 'svelte';
   */

  /**
   * @typedef {object} SidebarTab
   * @property {string} key Unique key of the tab.
   * @property {string} label Tab label.
   * @property {string} icon Material icon name.
   * @property {boolean} disabled Whether the tab is disabled.
   * @property {Component} panel The panel component to render when the tab is active.
   */

  const entryDraft = getEntryDraftContext();

  /** Whether any Relation field anywhere in the site can reference the current entry. */
  const isReferenced = $derived.by(() => {
    const collectionName = entryDraft.current?.collectionName;

    return (
      !!collectionName &&
      getReferencingRelationFields({ collectionName, fileName: entryDraft.current?.fileName })
        .length > 0
    );
  });

  /** @type {SidebarTab[]} */
  const tabs = $derived([
    {
      key: 'validation',
      label: _('entry_sidebar.validation.title'),
      icon: 'check_circle',
      disabled: false,
      panel: ValidationPanel,
    },
    {
      key: 'history',
      label: _('entry_sidebar.history.title'),
      icon: 'history',
      disabled: !backend.current?.isGit || !!entryDraft.current?.isNew,
      panel: HistoryPanel,
    },
    {
      key: 'backlinks',
      label: _('entry_sidebar.backlinks.title'),
      icon: 'article_shortcut',
      disabled: !isReferenced,
      panel: BacklinksPanel,
    },
  ]);

  /** @type {string | null} */
  let activeTab = $state(entryEditorSettings.current?.sidebarPanel ?? null);

  /** The displayed tab, falling back to Validation if the saved tab is unavailable. */
  const EffectiveTab = $derived(
    activeTab ? (tabs.find((t) => t.key === activeTab) ?? tabs[0]) : null,
  );

  $effect(() => {
    // Only track `activeTab`, not the settings being updated
    const settings = untrack(() => entryEditorSettings.current);

    entryEditorSettings.current = { ...settings, sidebarPanel: activeTab };
  });
</script>

<div role="none" class="sidebar">
  <SelectButtonGroup
    class="tabs"
    aria-label={_('entry_sidebar.sidebar_panels')}
    aria-controls="entry-sidebar-content"
  >
    {#each tabs as { key, label, icon, disabled } (key)}
      <SelectButton
        iconic
        aria-label={label}
        selected={EffectiveTab?.key === key}
        {disabled}
        onclick={() => {
          activeTab = activeTab === key ? null : key;
        }}
      >
        <Icon name={icon} />
      </SelectButton>
    {/each}
  </SelectButtonGroup>
  {#if EffectiveTab}
    <div role="none" class="content" id="entry-sidebar-content">
      <EffectiveTab.panel />
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
    border-radius: 16px 16px 0 0;
    background-color: var(--sui-primary-background-color);
  }
</style>
