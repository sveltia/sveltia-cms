<!--
  @component
  Control that opens the preview page for an entry: the deploy preview built for an unpublished
  Editorial Workflow entry when there is one, otherwise the page on the live site. It reflects the
  state of the deployment, so a build that hasn’t finished yet is presented as such instead of a
  link that would only return a 404. It renders as either a toolbar button or a menu item, because
  the entry editor offers the link in both places.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, Icon, MenuItem } from '@sveltia/ui';

  import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
  import { getEntryPreviewLink, refineState } from '$lib/services/deployments/link';
  import { pageLiveness, pingURL } from '$lib/services/deployments/ping';
  import { openNewTab } from '$lib/services/utils/window';

  /**
   * @import {
   * Entry,
   * InternalCollection,
   * InternalCollectionFile,
   * InternalLocaleCode,
   * WorkflowPullRequest,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Entry} entry Entry to be previewed.
   * @property {InternalLocaleCode} locale Locale of the entry to be previewed.
   * @property {InternalCollection} collection Collection that the entry belongs to.
   * @property {InternalCollectionFile} [collectionFile] Collection file. File/singleton collection
   * only.
   * @property {WorkflowPullRequest} [pullRequest] Pull request holding the entry, if it’s an
   * unpublished Editorial Workflow entry.
   * @property {'button' | 'menuitem'} [as] Form to be rendered.
   * @property {'primary' | 'secondary' | 'tertiary' | 'ghost' | 'link'} [variant] Style variant of
   * the button. Not used when the control is rendered as a menu item.
   * @property {'small' | 'medium' | 'large'} [size] Size of the button. Not used when the control
   * is rendered as a menu item.
   * @property {boolean} [iconic] Whether to show the icon alone, for a narrow screen where the
   * label wouldn’t fit alongside the other actions. The label becomes the accessible name. Not
   * used when the control is rendered as a menu item.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    entry,
    locale,
    collection,
    collectionFile,
    pullRequest,
    as = 'button',
    variant = 'ghost',
    size = 'medium',
    iconic = false,
    /* eslint-enable prefer-const */
  } = $props();

  // `$pageLiveness` is deliberately left out of this derivation. The effect below watches `url` and
  // writes that store, so reading it here would feed the check’s own result back into the URL it
  // checks. The liveness is folded into `state` alone, which the effect doesn’t read
  // @see https://github.com/sveltia/sveltia-cms/issues/943
  const link = $derived(
    getEntryPreviewLink({
      entry,
      locale,
      collection,
      collectionFile,
      pullRequest,
      deployments: $deployments,
      productionSHA: $productionSHA,
      pollTimedOut: $deployPollTimedOut,
    }),
  );
  const url = $derived(link?.url);
  const state = $derived(
    link ? refineState(link.state, url ? $pageLiveness[url] : undefined) : undefined,
  );
  const isDeployPreview = $derived(link?.isDeployPreview ?? false);
  const pingable = $derived(link?.pingable ?? false);
  // The URL leads to the published version, or nowhere when the entry is new, so the control waits
  // rather than sending anyone there
  const awaitingPreview = $derived(link?.awaitingPreview ?? false);
  // A failed build’s URL is its log rather than a preview, so there’s nothing worth opening. A
  // link to the live site is always worth offering, whatever the build did
  const disabled = $derived(awaitingPreview || !url || (isDeployPreview && state === 'error'));
  const label = $derived(
    awaitingPreview
      ? _('deploy_preview.awaiting')
      : isDeployPreview
        ? _('deploy_preview.view')
        : _('view_on_live_site'),
  );
  // The label says where the link goes, not what the build is doing, so anything other than a
  // finished build needs the reason spelled out
  const description = $derived(
    state === 'error'
      ? _('deploy_preview.failed')
      : state === 'checking'
        ? _('deploy_preview.checking')
        : state === 'pending'
          ? _('deploy_preview.building')
          : undefined,
  );

  /**
   * Open the resolved preview page in a new browser tab.
   */
  const open = () => {
    if (url) {
      openNewTab(url);
    }
  };

  $effect(() => {
    // Neither of these reads the liveness store this effect writes, so the check can’t retrigger
    // itself however the URL is composed
    const canPing = pingable;
    const pageURL = url;

    if (canPing && pageURL) {
      pingURL(pageURL);
    }

    return undefined;
  });
</script>

{#if link}
  {#if as === 'menuitem'}
    <MenuItem {label} {disabled} aria-description={description} onclick={open} />
  {:else}
    <Button
      {variant}
      {size}
      {iconic}
      label={iconic ? undefined : label}
      aria-label={iconic ? label : undefined}
      {disabled}
      aria-description={description}
      onclick={open}
    >
      {#snippet endIcon()}
        <div role="none" class="icon-wrapper">
          <Icon
            class={awaitingPreview ? 'spinning' : undefined}
            name={awaitingPreview ? 'progress_activity' : 'open_in_new'}
          />
        </div>
      {/snippet}
    </Button>
  {/if}
{/if}

<style>
  .icon-wrapper {
    display: contents;

    & :global(.spinning) {
      animation: spin 1.6s linear infinite;
    }

    @media (prefers-reduced-motion: reduce) {
      & :global(.spinning) {
        animation: none;
      }
    }
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
