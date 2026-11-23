<!--
  @component
  Tell whether someone else is editing the entry, with Sveltia CMS Additions entry locks, and offer
  to take it over.
-->
<script>
  import { _, locale as appLocale } from '@sveltia/i18n';
  import { Button, Infobar } from '@sveltia/ui';

  import { getLockNotice, takeOverLock } from '$lib/services/additions/locks.svelte';
  import { isViewer } from '$lib/services/config/readonly';
  import { formatRecentDateTime } from '$lib/services/utils/date';

  /**
   * @import { EntryLock, LockNotice } from '$lib/services/additions/locks.svelte';
   */

  /**
   * @typedef {object} Props
   * @property {string | undefined} lockKey Lock key of the entry, if it can be locked.
   */

  /** @type {Props} */
  let { lockKey } = $props();

  const notice = $derived(getLockNotice(lockKey));

  /**
   * The lock asked to be taken over, so the button doesn’t ask again until the service replaces it.
   * @type {EntryLock | undefined}
   */
  let requested = $state();

  /**
   * Get the message of a notice.
   * @param {LockNotice} lockNotice Notice.
   * @returns {string} Message.
   */
  const getMessage = (lockNotice) => {
    if (lockNotice.type === 'unavailable' || lockNotice.type === 'yours') {
      return _(
        `additions.locks.${lockNotice.type === 'yours' ? 'being_edited_by_you' : 'unavailable'}`,
      );
    }

    const { name, since } = lockNotice.lock;

    return lockNotice.type === 'held'
      ? _('additions.locks.being_edited', {
          values: {
            name,
            time: formatRecentDateTime({ timestamp: new Date(since), locale: appLocale.current }),
          },
        })
      : _('additions.locks.taken_over', { values: { name } });
  };
</script>

{#if notice}
  <Infobar
    dismissible={false}
    status={notice.type === 'unavailable' ? 'warning' : 'info'}
    --sui-infobar-border-width="0 0 1px"
    --sui-infobar-message-justify-content="center"
  >
    {getMessage(notice)}
    {#if notice.type !== 'unavailable' && !isViewer()}
      <Button
        variant="link"
        label={_('additions.locks.take_over')}
        disabled={requested === notice.lock}
        onclick={() => {
          requested = notice.lock;
          takeOverLock(/** @type {string} */ (lockKey));
        }}
      />
    {/if}
  </Infobar>
{/if}
