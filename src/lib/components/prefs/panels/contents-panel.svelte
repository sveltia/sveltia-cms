<script>
  import { Switch, TabPanel } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { prefs } from '$lib/services/prefs';

  $: closeOnSave = $prefs.closeOnSave ?? true;

  $: {
    if ($prefs.closeOnSave !== closeOnSave) {
      $prefs.closeOnSave = closeOnSave;
    }
  }
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
