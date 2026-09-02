import { getEntryPreviewURL } from '$lib/services/contents/entry';

/**
 * @import {
 * DeployState,
 * DeployStatus,
 * Entry,
 * EntryPreviewLink,
 * InternalCollection,
 * InternalCollectionFile,
 * InternalLocaleCode,
 * PageLiveness,
 * WorkflowPullRequest,
 * } from '$lib/types/private';
 */

/**
 * Combine the state reported by the CI/CD provider with the result of a liveness check on the
 * composed URL. A page that responds beats a stale build status, and a page that doesn’t respond
 * yet keeps a finished build in the pending state, which is what a CDN that hasn’t propagated looks
 * like. An inconclusive check never overrides the provider, and it never reports a failure.
 * @param {DeployState} state State reported by the provider.
 * @param {PageLiveness} [liveness] Result of the liveness check, if one was made.
 * @returns {DeployState} Refined state.
 */
export const refineState = (state, liveness) => {
  if (state === 'error' || !liveness || liveness === 'unknown') {
    return state;
  }

  if (liveness === 'ready') {
    return 'ready';
  }

  return state === 'ready' ? 'pending' : state;
};

/**
 * Resolve the preview link for one entry and locale, combining the site configuration with the
 * deployment stores. This is a pure function, so components can call it inside a `$derived` with
 * the store values passed in and stay reactive.
 *
 * The liveness of the composed URL is deliberately not taken into account here. A liveness check is
 * made from an effect that watches this URL, and it writes its result to the `pageLiveness` store,
 * so reading that store to resolve the link would put the store on both ends of the same cycle: the
 * check would change the link, the link would restart the check. Apply {@link refineState} to the
 * returned `state` separately to fold the liveness in.
 * @param {object} args Arguments.
 * @param {Entry} args.entry Entry.
 * @param {InternalLocaleCode} args.locale Locale.
 * @param {InternalCollection} args.collection Collection.
 * @param {InternalCollectionFile} [args.collectionFile] Collection file. File/singleton collection
 * only.
 * @param {WorkflowPullRequest} [args.pullRequest] Pull request holding the entry, if it’s an
 * unpublished Editorial Workflow entry.
 * @param {Record<string, DeployStatus>} args.deployments Value of the `deployments` store.
 * @param {string} args.productionSHA Value of the {@link productionSHA} store.
 * @param {boolean} [args.pollTimedOut] Value of the `deployPollTimedOut` store. Once the re-checks
 * have given up, the wait is over whatever the last reported state was.
 * @returns {EntryPreviewLink | undefined} Resolved link, or `undefined` when there’s nothing to
 * show.
 * @see https://github.com/sveltia/sveltia-cms/issues/943
 */
export const getEntryPreviewLink = ({
  entry,
  locale,
  collection,
  collectionFile,
  pullRequest,
  deployments: deployMap,
  productionSHA: prodSHA,
  pollTimedOut = false,
}) => {
  /**
   * Compose the full URL for the entry with the given base.
   * @param {string} [baseURL] Base URL, or `undefined` to use the configured site URL.
   * @returns {string | undefined} URL.
   */
  const compose = (baseURL) =>
    getEntryPreviewURL(entry, locale, collection, collectionFile, { baseURL });

  if (pullRequest) {
    const deploy = pullRequest.headSHA ? deployMap[pullRequest.headSHA] : undefined;
    const previewURL = deploy?.url ? compose(deploy.url) : undefined;

    if (deploy && previewURL) {
      return {
        url: previewURL,
        state: deploy.state,
        isDeployPreview: true,
        awaitingPreview: false,
        // A preview address only arrives once the build is done, so the one thing left to check is
        // whether the page is actually being served yet, exactly as for the live site
        pingable: true,
      };
    }

    // No preview to open: the build may still be queued, or no provider may report one at all.
    // Either way the live site link is what the CMS has always offered, so it stays where it is
    // rather than leaving the toolbar empty until a build appears. It isn’t checked for liveness,
    // because an unpublished entry isn’t on the live site yet. The build state still travels with
    // it, so the control can say that a preview is on its way
    const url = compose();

    if (!url) {
      return undefined;
    }

    const state = deploy?.state ?? 'unknown';

    return {
      url,
      state,
      isDeployPreview: false,
      // A build is on its way, so the live site isn’t where this entry can be seen — it holds the
      // published version, or nothing at all when the entry is new. The control says as much
      // rather than offering a link that leads somewhere else. Once the re-checks have given up,
      // nothing is coming, and a control that still says it’s waiting would be lying
      awaitingPreview: !pollTimedOut && (state === 'checking' || state === 'pending'),
      pingable: false,
    };
  }

  const deploy = prodSHA ? deployMap[prodSHA] : undefined;
  // The configured site URL wins; the deployment’s own URL fills in when `site_url` is unset
  const url = compose() ?? compose(deploy?.url);

  if (!url) {
    return undefined;
  }

  return {
    url,
    state: deploy?.state ?? 'unknown',
    isDeployPreview: false,
    // The live site is exactly where a published entry can be seen, whatever a build is doing
    awaitingPreview: false,
    pingable: true,
  };
};
