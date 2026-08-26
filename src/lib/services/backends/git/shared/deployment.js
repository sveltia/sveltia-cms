import { get } from 'svelte/store';

import { cmsConfig } from '$lib/services/config';

/**
 * @import { DeployState, DeployStatus } from '$lib/types/private';
 * @import { GitBackend } from '$lib/types/public';
 */

/**
 * A deployment candidate normalized from a commit status or a deployment reported by a CI/CD
 * provider connected to the Git backend. The two sources have different shapes, so each backend
 * converts them to this before handing the list to {@link pickDeployment}.
 * @typedef {object} DeployCandidate
 * @property {string} name Commit status context, check run name or deployment environment name.
 * @property {string} [url] URL reported alongside the candidate, if any.
 * @property {DeployState} state Normalized state.
 * @property {string} [description] Message the provider attached to the candidate, used to spot a
 * build that was canceled without failing.
 * @property {'deployment' | 'status' | 'check'} source Where the candidate came from, which decides
 * how much its URL can be trusted.
 */

/**
 * Names of commit status contexts and deployment environments that typically carry a site URL. It’s
 * used only as a hint when the `preview_context` backend option is not configured; a candidate that
 * doesn’t match is still usable, it just ranks lower. For a check run it does more — see
 * {@link pickDeployment} — so a provider missing from this list is invisible there, which is why
 * `workers` is here for Cloudflare’s “Workers Builds: <name>” runs. A generic `build` is left out
 * deliberately: it’s the name of half the CI jobs in existence, and letting those through would
 * have an unrelated test suite reporting on whether the site is live.
 */
const PREVIEW_NAME_REGEX =
  /netlify|vercel|cloudflare|workers|deploy|preview|pages|render|surge|amplify|firebase/i;

/** Names that suggest a production environment rather than a per-branch preview. */
const PRODUCTION_NAME_REGEX = /prod/i;
/**
 * Descriptions that mean the build never produced a preview. A provider can report such a build as
 * successful — a monorepo site untouched by the commit reports “Deploy preview canceled.” with a
 * success state — and its URL points at the build log rather than a page.
 * @see https://github.com/decaporg/decap-cms/issues/5107
 */
const NO_BUILD_DESCRIPTION_REGEX = /canceled|cancelled|skipped|no (?:changes|build)/i;
/**
 * How far a candidate’s URL can be trusted, highest first. A deployment’s environment URL is a
 * first-class field. A commit status target URL is usually the site, but sometimes a build log. A
 * check run’s details URL is normally a build log, and only some providers — AWS Amplify among them
 * — use it for the preview, so a check run is accepted only when its name says it’s a preview.
 */
const SOURCE_RANK = { deployment: 2, status: 1, check: 0 };

/**
 * Get the `preview_context` backend option, which narrows the deploy preview lookup to one commit
 * status context or deployment environment.
 * @returns {string} Configured context, or an empty string if the option is unset.
 */
export const getPreviewContext = () => {
  const { backend } = get(cmsConfig) ?? {};

  // @ts-ignore The option is GitHub/GitLab only
  return /** @type {GitBackend} */ (backend ?? {}).preview_context ?? '';
};

/**
 * Validate a URL reported by a CI/CD provider and strip any trailing slash, so it can be joined
 * with a `preview_path` value. The path, if any, is kept: GitLab Pages review apps and some
 * Cloudflare setups serve a preview under a path prefix rather than at the origin.
 * @param {string | undefined | null} url Raw URL.
 * @returns {string | undefined} Normalized URL, or `undefined` if it’s unusable.
 */
export const normalizeURL = (url) => {
  if (!url) {
    return undefined;
  }

  let parsed;

  try {
    parsed = new URL(url);
  } catch {
    return undefined;
  }

  // Refuse an insecure URL, which the browser would block anyway when the CMS is served over HTTPS
  if (parsed.protocol !== 'https:') {
    return undefined;
  }

  return parsed.href.replace(/\/$/, '');
};

/**
 * Find a site URL in a check run’s output summary. A provider that points its check at a build page
 * can still publish the deploy address there — Cloudflare Pages writes a table of preview URLs into
 * the summary while the check itself links to the Cloudflare dashboard. Any URL sharing a host with
 * the check’s own link is one of those dashboard links, so it’s passed over.
 * @param {string} [summary] Output summary, which is Markdown, HTML, or a mixture of the two.
 * @param {string} [detailsURL] The check run’s own URL.
 * @returns {string | undefined} First URL leading somewhere other than the provider’s dashboard.
 */
export const findURLInSummary = (summary, detailsURL) => {
  if (!summary) {
    return undefined;
  }

  let dashboardHost = '';

  try {
    dashboardHost = new URL(detailsURL ?? '').host;
  } catch {
    // The check may have no URL of its own, in which case there’s nothing to pass over
  }

  return (summary.match(/https:\/\/[^\s"'<>)\]]+/g) ?? [])
    .map((match) => normalizeURL(match))
    .find((url) => !!url && new URL(url).host !== dashboardHost);
};

/**
 * Whether a URL names a page on the Git service rather than a deployed site. A CI job that reports
 * through a commit status commonly links to its own log, and on GitLab every job does — `test`,
 * `lint` and the rest all post a status whose target URL is a job page on the GitLab instance.
 * @param {string | undefined} url Candidate URL.
 * @param {string} [selfURL] The repository’s own web URL, which shares a host with those pages.
 * @returns {boolean} Result, `false` when either URL can’t be parsed.
 */
const isGitServiceURL = (url, selfURL) => {
  try {
    return (
      new URL(/** @type {string} */ (url)).host === new URL(/** @type {string} */ (selfURL)).host
    );
  } catch {
    return false;
  }
};

/**
 * Rank a candidate so the best one can be picked with a single sort. A higher number wins.
 * @param {DeployCandidate} candidate Candidate to score.
 * @param {'production' | 'preview'} kind Kind of deployment expected.
 * @returns {number} Score.
 */
const getScore = ({ name, url, state, source }, kind) => {
  const isProductionName = PRODUCTION_NAME_REGEX.test(name);

  return (
    // A candidate with somewhere to go is worth more than one that only reports a state
    (url ? 32 : 0) +
    // A finished build with a page to open is the most useful thing to report, so it outranks a
    // more trustworthy source that hasn’t produced a URL yet
    (state === 'ready' ? 16 : 0) +
    SOURCE_RANK[source] * 4 +
    // An environment named after what’s being looked up beats the weaker name hint below, so a
    // `production` environment isn’t passed over for a `preview` one on the production branch
    ((kind === 'production') === isProductionName ? 2 : 0) +
    (PREVIEW_NAME_REGEX.test(name) ? 1 : 0)
  );
};

/**
 * Pick the deployment that best represents the site build for a commit. A `pending` result may have
 * no URL, because a provider doesn’t always assign one before the build starts; the UI shows that
 * as a disabled control rather than a link.
 * @param {DeployCandidate[]} candidates Candidates, oldest first.
 * @param {object} args Arguments.
 * @param {'production' | 'preview'} args.kind Kind of deployment expected for the commit.
 * @param {string} [args.selfURL] The repository’s own web URL, used to spot a URL that leads back
 * to the Git service instead of to the site.
 * @returns {DeployStatus} Selected deployment.
 */
export const pickDeployment = (candidates, { kind, selfURL }) => {
  const previewContext = getPreviewContext();
  let remaining = candidates;

  if (previewContext) {
    const needle = previewContext.toLowerCase();
    // Decap CMS matches the context exactly, so an exact match wins to stay compatible with an
    // existing configuration. A partial value falls back to a substring match rather than silently
    // matching nothing, which is the more useful reading of a half-remembered context name
    const exact = remaining.filter(({ name }) => name.toLowerCase() === needle);

    remaining = exact.length
      ? exact
      : remaining.filter(({ name }) => name.toLowerCase().includes(needle));
  } else {
    // Without an explicit context to go by, a check run counts only when its name suggests a
    // deployment at all — an ordinary CI job says nothing about whether the site is live, and its
    // details URL is a build log
    remaining = remaining.filter(
      ({ name, source }) => source !== 'check' || PREVIEW_NAME_REGEX.test(name),
    );
  }

  // A build that was canceled or skipped has no page behind it, whatever state it reports
  remaining = remaining.filter(
    ({ description }) => !description || !NO_BUILD_DESCRIPTION_REGEX.test(description),
  );

  // A URL is worth something only once the provider says the build is done. Before that there’s
  // nothing behind it, and a provider with no address to give out yet may offer its own dashboard
  // in the meantime — Cloudflare Pages does, replacing it with the real one on success. A finished
  // build can still name a page on the Git service instead of a site. Either way the state is kept
  // and only the URL is dropped, which the caller pairs with the site’s own address
  remaining = remaining.map((candidate) => ({
    ...candidate,
    url:
      candidate.state === 'ready' && !isGitServiceURL(candidate.url, selfURL)
        ? normalizeURL(candidate.url)
        : undefined,
  }));

  if (!remaining.length) {
    // Configuring `preview_context` is an explicit narrowing, so an unmatched value doesn’t fall
    // back to the other candidates. That matches Decap CMS, which has no fallback either
    return { state: 'unknown', checkedTime: Date.now() };
  }

  // The backends supply candidates oldest first, so a later one wins a tie
  const [best] = remaining
    .map((candidate, index) => ({ candidate, index, score: getScore(candidate, kind) }))
    .sort((a, b) => b.score - a.score || b.index - a.index)
    .map(({ candidate }) => candidate);

  return {
    state: best.state,
    url: best.url,
    context: best.name,
    checkedTime: Date.now(),
  };
};
