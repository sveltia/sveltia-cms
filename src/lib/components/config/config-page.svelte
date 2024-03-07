<script>
  import { _ } from 'svelte-i18n';
  import YAML from 'yaml';
  import PageContainer from '$lib/components/common/page-container.svelte';
  import { siteConfig } from '$lib/services/config';
</script>

<PageContainer class="content" aria-label={$_('site_configuration_editor')}>
  <svelte:fragment slot="main">
    <div role="blockquote" aria-label={$_('site_config')}>
      <pre>{YAML.stringify($siteConfig)}</pre>
    </div>
  </svelte:fragment>
</PageContainer>

<style lang="scss">
  div {
    flex: auto;
    overflow: auto;
  }

  pre {
    margin: 0;
    padding: 16px;
  }
</style>
