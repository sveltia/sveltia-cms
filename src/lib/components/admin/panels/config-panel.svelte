<!--
  @component
  The CMS configuration, as loaded, for developers.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { stringify } from 'yaml';

  import MainArea from '$lib/components/admin/main-area.svelte';
  import { rawCmsConfig } from '$lib/services/config';

  /**
   * @typedef {object} Props
   * @property {string} title Title of the section.
   */

  /** @type {Props} */
  let { title } = $props();
</script>

<MainArea {title}>
  <div role="blockquote" aria-label={_('cms_config')}>
    <pre>{stringify(rawCmsConfig)}</pre>
  </div>
</MainArea>

<style>
  div {
    flex: auto;
    overflow: auto;
    margin: -16px;
  }

  pre {
    margin: 0;
    padding: 16px;
    width: 100%;
    min-width: fit-content;
    min-height: -moz-available;
    min-height: -webkit-fill-available;
    min-height: stretch;
    background-color: var(--sui-primary-background-color);
  }
</style>
