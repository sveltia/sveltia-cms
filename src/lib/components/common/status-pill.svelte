<!--
  @component
  Small filled pill showing a status label, such as the Editorial Workflow status or the deploy
  preview state of an unpublished entry.
-->
<script>
  /**
   * @import { StatusPillTone } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {StatusPillTone} tone Color tone of the pill.
   * @property {string} label Text to be shown.
   * @property {string} [class] Additional class names for the element.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    tone,
    label,
    class: className = '',
    /* eslint-enable prefer-const */
  } = $props();
</script>

<span role="none" class={['status-pill', tone, className]}>
  {label}
</span>

<style>
  /*
   * Filled pill following the same background/foreground/border recipe as the Alert and Infobar
   * components, so the colors adapt to both the light and dark themes. The border does most of the
   * work in dark mode, where the alert background is nearly the same as the row background.
   */

  .status-pill {
    display: inline-block;
    border-width: 1px;
    border-style: solid;
    border-radius: 12px;
    padding: 1px 6px;
    font-size: var(--sui-font-size-x-small);
    line-height: var(--sui-line-height-compact);
    white-space: nowrap;

    &.info {
      border-color: var(--sui-info-border-color);
      background-color: var(--sui-info-background-color);
      color: var(--sui-info-foreground-color);
    }

    &.warning {
      border-color: var(--sui-warning-border-color);
      background-color: var(--sui-warning-background-color);
      color: var(--sui-warning-foreground-color);
    }

    &.success {
      border-color: var(--sui-success-border-color);
      background-color: var(--sui-success-background-color);
      color: var(--sui-success-foreground-color);
    }

    &.error {
      border-color: var(--sui-error-border-color);
      background-color: var(--sui-error-background-color);
      color: var(--sui-error-foreground-color);
    }
  }
</style>
