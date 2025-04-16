<script>
  import { _ } from 'svelte-i18n';
  import YAML from 'yaml';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import { rawSiteConfig } from '$lib/services/config';
</script>

<PageContainer aria-label={$_('site_configuration_editor')}>
  {#snippet main()}
    <div role="blockquote" aria-label={$_('site_config')}>
      <pre>{YAML.stringify(rawSiteConfig)}</pre>
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
    background-color: var(--sui-primary-background-color);
  }
</style>
