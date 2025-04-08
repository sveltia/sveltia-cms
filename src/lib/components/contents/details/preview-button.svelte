<script>
  import { Button, Icon } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Writable<?EntryEditorPane>} thisPane This pane’s mode and locale.
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
  aria-label={$_('preview')}
  pressed={$thisPane?.mode === 'preview'}
  onclick={() => {
    $thisPane = {
      mode: $thisPane?.mode === 'preview' ? 'edit' : 'preview',
      locale: $thisPane?.locale ?? '',
    };
  }}
>
  {#snippet startIcon()}
    <Icon name="visibility" />
  {/snippet}
</Button>
