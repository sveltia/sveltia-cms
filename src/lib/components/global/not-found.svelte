<script>
  import { _ } from '@sveltia/i18n';
  import { Button, EmptyState } from '@sveltia/ui';

  import { goBack } from '$lib/services/app/navigation';

  /**
   * @typedef {object} Props
   * @property {string} message Message describing what couldn’t be found.
   * @property {string} [backPath] URL path to navigate to when there’s no previous page to return
   * to, which is the case when the user has opened the dead link directly.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    message,
    backPath = '/collections',
    /* eslint-enable prefer-const */
  } = $props();
</script>

<EmptyState>
  <span role="none">{message}</span>
  <Button
    variant="primary"
    onclick={() => {
      goBack(backPath);
    }}
  >
    {_('back')}
  </Button>
</EmptyState>
