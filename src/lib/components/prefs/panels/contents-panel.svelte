<script>
  import { TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import PrefSwitch from '$lib/components/prefs/controls/pref-switch.svelte';

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

<TabPanel id="prefs-tab-contents">
  <section>
    <h4>{$_('prefs.contents.editor.title')}</h4>
    <div role="none">
      <PrefSwitch
        key="useDraftBackup"
        label={$_('prefs.contents.editor.use_draft_backup.switch_label')}
      />
    </div>
    <div role="none">
      <PrefSwitch
        key="closeOnSave"
        label={$_('prefs.contents.editor.close_on_save.switch_label')}
      />
    </div>
  </section>
</TabPanel>
