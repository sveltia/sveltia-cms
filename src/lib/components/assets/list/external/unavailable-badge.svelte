<!--
  @component
  Pill marking a linked file that couldn’t be loaded, e.g. because it has been deleted, so that it
  stands out in the asset list. Follows the Editorial Workflow status badge.
-->
<script>
  import { _ } from '@sveltia/i18n';
</script>

<span role="none" class="badge">
  {_('file_unavailable')}
</span>

<style>
  /*
   * Filled pill following the same background/foreground/border recipe as the Alert and Infobar
   * components, so the colors adapt to both the light and dark themes.
   */

  .badge {
    display: inline-block;
    border-width: 1px;
    border-style: solid;
    border-radius: 12px;
    border-color: var(--sui-error-border-color);
    padding: 1px 6px;
    background-color: var(--sui-error-background-color);
    color: var(--sui-error-foreground-color);
    font-size: var(--sui-font-size-x-small);
    line-height: var(--sui-line-height-compact);
    white-space: nowrap;
  }
</style>
