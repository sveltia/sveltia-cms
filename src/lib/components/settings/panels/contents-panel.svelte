<script>
  import { _ } from 'svelte-i18n';

  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();
</script>

<section>
  <h4>{$_('prefs.contents.editor.title')}</h4>
  <div role="none">
    <PrefSwitch
      key="useDraftBackup"
      label={$_('prefs.contents.editor.use_draft_backup.switch_label')}
    />
  </div>
  <div role="none">
    <PrefSwitch key="closeOnSave" label={$_('prefs.contents.editor.close_on_save.switch_label')} />
  </div>
  <div role="none">
    <PrefSwitch
      key="closeWithEscape"
      label={$_('prefs.contents.editor.close_with_escape.switch_label')}
    />
  </div>
</section>
