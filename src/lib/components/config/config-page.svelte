<script>
  import { _ } from 'svelte-i18n';
  import { stringify } from 'yaml';

  import PageContainer from '$lib/components/common/page-container.svelte';
  import { rawCmsConfig } from '$lib/services/config';
</script>

<PageContainer aria-label={$_('site_configuration_editor')}>
  {#snippet main()}
    <div role="blockquote" aria-label={$_('cms_config')}>
      <pre>{stringify(rawCmsConfig)}</pre>
    </div>
  {/snippet}
</PageContainer>

<style lang="scss">
  div {
    flex: auto;
    overflow: auto;
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
