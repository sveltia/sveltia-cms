<script>
  import { Icon, isRTL } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {boolean} [expanded] Whether the icon indicates an expanded state.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    expanded = false,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Icon name={expanded ? 'expand_more' : $isRTL ? 'chevron_left' : 'chevron_right'} />
