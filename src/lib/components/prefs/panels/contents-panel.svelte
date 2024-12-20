<script>
  import { Switch, TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] - Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();

  let closeOnSave = $state(true);

  $effect(() => {
    closeOnSave = $prefs.closeOnSave ?? true;
  });

  $effect(() => {
    if ($prefs.closeOnSave !== closeOnSave) {
      $prefs.closeOnSave = closeOnSave;
    }
  });
</script>

<TabPanel id="prefs-tab-contents">
  <section>
    <h4>{$_('prefs.contents.editor.title')}</h4>
    <div role="none">
      <Switch
        label={$_('prefs.contents.editor.close_on_save.switch_label')}
        bind:checked={closeOnSave}
      />
    </div>
  </section>
</TabPanel>
