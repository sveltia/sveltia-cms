<script>
  import { _ } from '@sveltia/i18n';
  import { Divider, Menu, MenuButton, MenuItem, Spacer, Toolbar } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { writable } from 'svelte/store';

  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import TranslateButton from '$lib/components/contents/details/editor/translate-button.svelte';
  import LocaleSwitcher from '$lib/components/contents/details/locale-switcher.svelte';
  import PreviewButton from '$lib/components/contents/details/preview-button.svelte';
  import PreviewLinkButton from '$lib/components/contents/details/preview-link-button.svelte';
  import { backend } from '$lib/services/backends';
  import { entryDraft, filterRealValues } from '$lib/services/contents/draft';
  import { toggleLocale } from '$lib/services/contents/draft/update/locale';
  import { revertChanges } from '$lib/services/contents/draft/update/revert';
  import { getValueMapSnapshot } from '$lib/services/contents/draft/value-map.svelte';
  import { getEntryRepoBlobURL } from '$lib/services/contents/entry';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';
  import { deployPollTimedOut } from '$lib/services/deployments';
  import { recheckDeployments } from '$lib/services/deployments/poll';
  import { env } from '$lib/services/user/env.svelte';
  import { prefs } from '$lib/services/user/prefs.svelte';
  import { openNewTab } from '$lib/services/utils/window';
  import { isPendingDeletion, unpublishedEntries, workflowEnabled } from '$lib/services/workflow';
  import { getBranchName } from '$lib/services/workflow/branch';

  /**
   * @import { Writable } from 'svelte/store';
   * @import { EntryEditorPane } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} id The wrapper element’s `id` attribute.
   * @property {Writable<?EntryEditorPane>} thisPane This pane’s mode and locale.
   * @property {Writable<?EntryEditorPane>} [thatPane] Another pane’s mode and locale.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    id,
    thisPane,
    thatPane = writable(null),
    /* eslint-enable prefer-const */
  } = $props();

  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const originalEntry = $derived($entryDraft?.originalEntry);
  const originalValues = $derived($entryDraft?.originalValues ?? {});
  const { i18nEnabled, saveAllLocales, allLocales, defaultLocale } = $derived(
    (collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG,
  );
  const isLocaleEnabled = $derived($entryDraft?.currentLocales[$thisPane?.locale ?? '']);
  const isOnlyLocale = $derived(
    Object.values($entryDraft?.currentLocales ?? {}).filter((enabled) => enabled).length === 1,
  );
  const otherLocales = $derived(
    i18nEnabled ? allLocales.filter((l) => l !== $thisPane?.locale) : [],
  );
  const canCopy = $derived(!!otherLocales.length);
  // Every option in the menu edits the content, which an entry awaiting deletion doesn’t allow
  const pendingDeletion = $derived(isPendingDeletion($entryDraft?.originalEntry));
  const canRevert = $derived(
    $thisPane?.locale &&
      !equal(
        originalValues[$thisPane.locale],
        // Exclude internal properties from the comparison
        filterRealValues(getValueMapSnapshot($entryDraft, $thisPane.locale)),
      ),
  );
  const canPreview = $derived($entryDraft?.canPreview ?? true);
  // Look the entry up in the store rather than reading the draft, so the preview link follows the
  // head commit as it moves with each save, the same way the entry toolbar does
  const workflowBranch = $derived(
    $workflowEnabled && $entryDraft?.collectionName && originalEntry
      ? getBranchName({
          collectionName: $entryDraft.collectionName,
          slug: $entryDraft.fileName ?? originalEntry.slug,
        })
      : undefined,
  );
  const pullRequest = $derived(
    workflowBranch
      ? $unpublishedEntries.find(({ workflow }) => workflow.pullRequest.branch === workflowBranch)
          ?.workflow.pullRequest
      : undefined,
  );
</script>

<div role="none" {id} class="header">
  <Toolbar variant="secondary" aria-label={_('secondary')}>
    {#if i18nEnabled && allLocales.length > 1}
      <LocaleSwitcher {id} {thisPane} {thatPane} />
      {#if (env.isSmallScreen || env.isMediumScreen) && canPreview}
        <PreviewButton {thisPane} />
      {/if}
    {:else if !(env.isSmallScreen || env.isMediumScreen)}
      <h3 role="none">{$thisPane?.mode === 'preview' ? _('preview') : _('edit')}</h3>
    {:else if canPreview}
      <PreviewButton {thisPane} />
    {/if}
    <Spacer flex />
    {#if $thisPane?.mode === 'edit'}
      {@const localeLabel = getLocaleLabel($thisPane.locale) ?? $thisPane.locale}
      {#if canCopy}
        <TranslateButton locale={$thisPane.locale} {otherLocales} />
      {/if}
      <MenuButton
        variant="ghost"
        iconic
        disabled={pendingDeletion}
        popupPosition="bottom-right"
        aria-label={_('show_content_options_x_locale', { values: { locale: localeLabel } })}
      >
        {#snippet popup()}
          <Menu aria-label={_('content_options_x_locale', { values: { locale: localeLabel } })}>
            {#if canCopy && $thisPane?.locale}
              <CopyMenuItems locale={$thisPane.locale} {otherLocales} />
            {/if}
            <MenuItem
              label={_('revert_changes')}
              disabled={!canRevert}
              onclick={() => {
                revertChanges({ locale: $thisPane?.locale });
              }}
            />
            {#if !saveAllLocales && $thisPane?.locale}
              <Divider />
              <MenuItem
                label={_(
                  isLocaleEnabled
                    ? 'disable_x_locale'
                    : $entryDraft?.currentValues[$thisPane.locale]
                      ? 'reenable_x_locale'
                      : 'enable_x_locale',
                  { values: { locale: localeLabel } },
                )}
                disabled={$thisPane.locale === defaultLocale || (isLocaleEnabled && isOnlyLocale)}
                onclick={() => {
                  toggleLocale($thisPane?.locale ?? '');
                }}
              />
            {/if}
            {#if originalEntry && collection && $thisPane}
              <Divider />
              <PreviewLinkButton
                as="menuitem"
                entry={originalEntry}
                locale={$thisPane.locale}
                {collection}
                {collectionFile}
                {pullRequest}
              />
              {#if $deployPollTimedOut}
                <MenuItem
                  label={_('deploy_preview.check_again')}
                  onclick={() => {
                    recheckDeployments();
                  }}
                />
              {/if}
              {#if prefs.devModeEnabled}
                <MenuItem
                  disabled={!$backend?.repository?.blobBaseURL}
                  label={_('view_on_x', {
                    values: { service: $backend?.repository?.label },
                    default: _('view_in_repository'),
                  })}
                  onclick={() => {
                    if (originalEntry && $thisPane) {
                      openNewTab(getEntryRepoBlobURL(originalEntry, $thisPane.locale));
                    }
                  }}
                />
              {/if}
            {/if}
          </Menu>
        {/snippet}
      </MenuButton>
    {/if}
  </Toolbar>
</div>

<style>
  .header {
    flex: none !important;

    :global {
      & > .sui.toolbar {
        margin-inline: auto;
        max-width: 800px;

        @media (width < 768px) {
          padding: 0;
        }

        h3 {
          margin: 0 8px;
          font-size: var(--sui-font-size-default);
        }
      }
    }
  }
</style>
