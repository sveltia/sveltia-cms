<!--
  @component
  Render the menu items that show or hide the second pane and the preview, and turn the scroll
  syncing on or off, preceded by a separator. The editor options menu lists them on a large screen.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, MenuItemCheckbox } from '@sveltia/ui';

  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    entryEditorSettings,
    toggleEntryEditorSetting,
  } from '$lib/services/contents/editor/settings';
  import { getDraftI18nConfig } from '$lib/services/contents/i18n/config';

  const entryDraft = getEntryDraftContext();

  const { i18nEnabled, allLocales } = $derived(getDraftI18nConfig(entryDraft.current));
  const canPreview = $derived(entryDraft.current?.canPreview ?? true);
  const showSecondPane = $derived(entryEditorSettings.current?.showSecondPane ?? true);
  // There’s only something to put in the second pane when another locale can be edited alongside
  // the first one, or when the entry has a preview
  const canShowSecondPane = $derived((i18nEnabled && allLocales.length > 1) || canPreview);
  // Whether the preview is shown in the second pane, which is all the pane shows for an entry with
  // a single locale, so there’s nothing to sync the scrolling with otherwise
  const previewShown = $derived(canPreview && !!entryEditorSettings.current?.showPreview);
  /* v8 ignore start -- only read while the draft is there, and the preview is hidden */
  const hasSingleLocale = $derived(
    Object.keys(entryDraft.current?.currentValues ?? {}).length === 1,
  );
  /* v8 ignore stop */
</script>

<Divider />
<MenuItemCheckbox
  label={_('show_second_pane')}
  checked={showSecondPane}
  disabled={!canShowSecondPane}
  onChange={() => {
    toggleEntryEditorSetting('showSecondPane', true);
  }}
/>
<!-- The preview is rendered in the second pane, so it’s unavailable while hidden -->
<MenuItemCheckbox
  label={_('show_preview')}
  checked={entryEditorSettings.current?.showPreview}
  disabled={!showSecondPane || !canPreview}
  onChange={() => {
    toggleEntryEditorSetting('showPreview');
  }}
/>
<MenuItemCheckbox
  label={_('sync_scrolling')}
  checked={entryEditorSettings.current?.syncScrolling}
  disabled={!showSecondPane || (!previewShown && hasSingleLocale)}
  onChange={() => {
    toggleEntryEditorSetting('syncScrolling');
  }}
/>
