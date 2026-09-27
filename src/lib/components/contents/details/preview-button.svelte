<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon } from '@sveltia/ui';

  import { afterPendingFieldUpdates } from '$lib/services/contents/editor/pending';

  /**
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {{ current: ?EntryEditorPane }} thisPane This pane’s mode and locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    thisPane,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Button
  variant="ghost"
  iconic
  aria-label={_('preview')}
  pressed={thisPane.current?.mode === 'preview'}
  onclick={() => {
    // The preview replaces the field editors, which would drop an update still in flight
    afterPendingFieldUpdates(() => {
      thisPane.current = {
        mode: thisPane.current?.mode === 'preview' ? 'edit' : 'preview',
        locale: thisPane.current?.locale ?? '',
      };
    });
  }}
>
  {#snippet startIcon()}
    <Icon name="visibility" />
  {/snippet}
</Button>
