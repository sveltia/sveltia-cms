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

  let underlineLinks = $state(true);

  $effect(() => {
    underlineLinks = $prefs.underlineLinks ?? true;
  });

  $effect(() => {
    if ($prefs.underlineLinks !== underlineLinks) {
      $prefs.underlineLinks = underlineLinks;
    }
  });
</script>

<TabPanel id="prefs-tab-accessibility">
  <section>
    <h4>
      {$_('prefs.accessibility.underline_links.title')}
    </h4>
    <p>
      {$_('prefs.accessibility.underline_links.description')}
    </p>
    <div role="none">
      <Switch
        bind:checked={underlineLinks}
        label={$_('prefs.accessibility.underline_links.switch_label')}
      />
    </div>
  </section>
</TabPanel>
