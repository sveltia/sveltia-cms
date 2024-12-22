<script>
  import { Alert, Toast } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { entryParseErrors } from '$lib/services/contents';

  let showParseErrorToast = $state(!!$entryParseErrors.length);
</script>

<Toast bind:show={showParseErrorToast}>
  <Alert status="error">
    {$_($entryParseErrors.length === 1 ? 'entry_parse_error' : 'entry_parse_errors')}
  </Alert>
</Toast>
