<script>
  import { Switch } from '@sveltia/ui';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @typedef {object} Props
   * @property {string} key Preference key.
   * @property {string} label UI label on the switch.
   * @property {boolean} [defaultValue] Default value.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    key,
    label,
    defaultValue = true,
    /* eslint-enable prefer-const */
  } = $props();

  let checked = $state(true);

  $effect(() => {
    checked = Boolean(/** @type {Record<string, any>} */ ($prefs)[key] ?? defaultValue);
  });

  $effect(() => {
    if (/** @type {Record<string, any>} */ ($prefs)[key] !== checked) {
      /** @type {Record<string, any>} */ ($prefs)[key] = checked;
    }
  });
</script>

<Switch bind:checked {label} />
