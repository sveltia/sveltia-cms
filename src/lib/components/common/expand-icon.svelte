<script>
  import { isRTL } from '@sveltia/i18n';
  import { Icon } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {boolean} [expanded] Whether the icon indicates an expanded state.
   */

  /** @type {Props} */
  let { expanded = false } = $props();
</script>

<Icon name={expanded ? 'expand_more' : isRTL() ? 'chevron_left' : 'chevron_right'} />
