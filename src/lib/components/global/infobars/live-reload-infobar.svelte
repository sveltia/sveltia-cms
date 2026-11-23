<script>
  import { _ } from '@sveltia/i18n';
  import { Infobar } from '@sveltia/ui';

  import { isLiveReloadedPage, LIVE_RELOAD_DOCS_URL } from '$lib/services/app/dev-server';
  import { backendName } from '$lib/services/backends';
  import { makeLink } from '$lib/services/utils/string';

  // A reload only does harm while the CMS is writing files to the local repository
  const show = $derived(backendName.current === 'local' && isLiveReloadedPage());
</script>

<Infobar {show} status="warning" --sui-infobar-message-justify-content="center">
  {@html makeLink(_('live_reload_warning'), LIVE_RELOAD_DOCS_URL)}
</Infobar>
