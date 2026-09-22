<script>
  import { _ } from '@sveltia/i18n';

  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';
</script>

<section>
  <h3>{_('prefs.contents.editor.title')}</h3>
  <div role="none">
    <PrefSwitch
      key="useDraftBackup"
      label={_('prefs.contents.editor.use_draft_backup.switch_label')}
    />
  </div>
  <div role="none">
    <PrefSwitch key="closeOnSave" label={_('prefs.contents.editor.close_on_save.switch_label')} />
  </div>
  <div role="none">
    <PrefSwitch
      key="closeWithEscape"
      label={_('prefs.contents.editor.close_with_escape.switch_label')}
    />
  </div>
</section>
