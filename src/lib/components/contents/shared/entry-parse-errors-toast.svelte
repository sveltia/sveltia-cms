<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Toast } from '@sveltia/ui';

  import { entryParseErrors } from '$lib/services/contents';

  let showParseErrorToast = $state(!!$entryParseErrors.length);
</script>

<Toast bind:show={showParseErrorToast}>
  <Alert status="error">
    {_('entry_parse_errors', { values: { count: $entryParseErrors.length } })}
  </Alert>
</Toast>
