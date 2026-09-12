<!--
  @component
  Preview button that opens the asset details overlay, shared by repository assets and assets on
  external locations.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import { goto } from '$lib/services/app/navigation';

  /**
   * @typedef {object} Props
   * @property {string} [path] Path of the details overlay, or `undefined` if no asset is selected.
   * @property {boolean} [disabled] Whether the asset can’t be previewed.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    path = undefined,
    disabled = false,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Button
  variant="ghost"
  disabled={disabled || !path}
  label={_('preview')}
  aria-label={_('show_preview')}
  onclick={() => {
    goto(/** @type {string} */ (path), { transitionType: 'forwards' });
  }}
/>
