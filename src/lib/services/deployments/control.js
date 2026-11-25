import { cmsConfig } from '$lib/services/config';
import { deployments, deployPollTimedOut, productionSHA } from '$lib/services/deployments';
import { DEPLOY_STATE_MESSAGES } from '$lib/services/deployments/constants';
import { getEntryPreviewLink, refineState } from '$lib/services/deployments/link';

/**
 * @import {
 * Entry,
 * EntryPreviewLink,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * PageLiveness,
 * PreviewLinkControl,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

/**
 * Resolve the preview link of an entry from the deployment stores, for a control to offer. Called
 * from a `$derived`, it reads the stores, and runs again whenever they change, only when the link
 * follows the deploy state: an unpublished entry’s link always does, since its deploy preview is
 * only known from there, and so does any link without the `site_url` option, which only the
 * production deployment’s own URL can stand in for. A published entry’s link to the configured
 * site doesn’t otherwise need them, so a list of entries can leave its published rows untouched by
 * every answer the deploy state lookup brings.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {InternalCollection} args.collection Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {WorkflowPullRequest} [args.pullRequest] Pull request holding the entry, if it’s an
 * unpublished Editorial Workflow entry.
 * @param {boolean} [args.trackDeployState] Whether to follow the deploy state of a published entry
 * too, as the entry editor does to say that the site is still being built.
 * @returns {EntryPreviewLink | undefined} Resolved link, or `undefined` when there’s nothing to
 * show.
 */
export const resolveEntryPreviewLink = ({ trackDeployState = true, ...args }) => {
  const track = trackDeployState || !!args.pullRequest || !cmsConfig.current?._baseURL;

  return getEntryPreviewLink({
    ...args,
    deployments: track ? deployments.current : {},
    productionSHA: track ? productionSHA.current : '',
    pollTimedOut: track && deployPollTimedOut.current,
  });
};

/**
 * Work out what a preview link control shows for a resolved link: whether it can be opened, what
 * it’s called and how the build is described. The label says where the link goes, not what the
 * build is doing, so anything other than a finished build needs the reason spelled out.
 * @param {EntryPreviewLink} link Resolved link.
 * @param {PageLiveness} [liveness] Result of the liveness check on the link’s URL, if one was made.
 * @returns {PreviewLinkControl} What the control shows.
 */
export const getPreviewLinkControl = (link, liveness) => {
  const { url, isDeployPreview, awaitingPreview } = link;
  const state = refineState(link.state, liveness);

  return {
    // The URL leads to the published version, or nowhere when the entry is new, so the control
    // waits rather than sending anyone there. A failed build’s URL is its log rather than a
    // preview, so there’s nothing worth opening either. A link to the live site is always worth
    // offering, whatever the build did
    disabled: awaitingPreview || !url || (isDeployPreview && state === 'error'),
    labelKey: awaitingPreview
      ? 'deploy_preview.awaiting'
      : isDeployPreview
        ? 'deploy_preview.view'
        : 'view_on_live_site',
    descriptionKey: DEPLOY_STATE_MESSAGES[state],
  };
};
