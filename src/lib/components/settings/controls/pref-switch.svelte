<script>
  import { Switch } from '@sveltia/ui';

  import { prefs } from '$lib/services/user/prefs.svelte';

  /**
   * @typedef {object} Props
   * @property {string} key Preference key.
   * @property {string} label UI label on the switch.
   * @property {boolean} [defaultValue] Default value.
   */

  /** @type {Props} */
  let { key, label, defaultValue = true } = $props();

  /**
   * Preferences, cast to allow access by an arbitrary key.
   */
  const _prefs = /** @type {Record<string, any>} */ (prefs);
</script>

<Switch
  bind:checked={
    () => Boolean(_prefs[key] ?? defaultValue),
    (value) => {
      _prefs[key] = value;
    }
  }
  {label}
/>
