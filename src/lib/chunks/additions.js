/**
 * Entry point of the `additions` chunk, built separately from the main bundle and loaded on demand,
 * as only a site configured with Sveltia CMS Additions (`auth_type: additions`) needs it. It’s
 * loaded along with the backend, before the sign-in page offers anything, so the rest of the app
 * can use it synchronously once the user is signed in; see `loadAdditions()`. The modules it shares
 * with the rest of the app come from the main bundle, see `shareMainModules()` in `vite.config.js`.
 */
import { addMessages } from '@sveltia/i18n';

import CredentialsPanel from '$lib/components/additions/admin/credentials-panel.svelte';
import DomainsPanel from '$lib/components/additions/admin/domains-panel.svelte';
import GitHubPanel from '$lib/components/additions/admin/github-panel.svelte';
import SignInPanel from '$lib/components/additions/admin/sign-in-panel.svelte';
import UsersPanel from '$lib/components/additions/admin/users-panel.svelte';
import strings from '$lib/locales/en-US.yaml?only=additions';

// The English strings, which the main bundle leaves out; the other locales have them in their own
// files, loaded from the CDN
addMessages('en-US', strings);

/**
 * Sections of the Administration page for the admins of Sveltia CMS Additions, in the order they’re
 * listed, with the panel each shows. See `getAdminSections()`.
 * @type {import('$lib/services/app/admin').AdminSection[]}
 */
export const adminSections = [
  { key: 'users', labelKey: 'additions.users.title', icon: 'group', component: UsersPanel },
  {
    key: 'sign-in',
    labelKey: 'additions.users.sign_in_tab',
    icon: 'login',
    component: SignInPanel,
  },
  {
    key: 'domains',
    labelKey: 'additions.users.domains_tab',
    icon: 'language',
    component: DomainsPanel,
  },
  { key: 'github', labelKey: 'additions.users.github_tab', icon: 'commit', component: GitHubPanel },
  {
    key: 'credentials',
    labelKey: 'additions.credentials.title',
    icon: 'key',
    component: CredentialsPanel,
  },
];

export { default as UpdateInfobar } from '$lib/components/additions/admin/update-infobar.svelte';
export { default as ConversationPanel } from '$lib/components/additions/conversation/conversation-panel.svelte';
export { default as EntryActivity } from '$lib/components/additions/locks/entry-activity.svelte';
export { default as EntryLockInfobar } from '$lib/components/additions/locks/entry-lock-infobar.svelte';
export { default as EntryViewers } from '$lib/components/additions/locks/entry-viewers.svelte';
export { default as SetupWizard } from '$lib/components/additions/sign-in/setup-wizard.svelte';
export { default as SignInForm } from '$lib/components/additions/sign-in/sign-in-form.svelte';
export { default as AccountPanel } from '$lib/components/additions/users/account-panel.svelte';
export {
  additionsAuth,
  changeTemporaryPassword,
  linkGitHubAccount,
  signInWithAdditions,
  signOutFromAdditions,
} from '$lib/services/additions/auth.svelte';
export { deleteEntryComments } from '$lib/services/additions/comments.svelte';
export {
  getConversationCount,
  moveEntryConversation,
} from '$lib/services/additions/conversation.svelte';
export { sharedCredentials } from '$lib/services/additions/credentials.svelte';
export { getDraftLockKey, getOthersLock, watchEntry } from '$lib/services/additions/locks.svelte';
export { prepareSignIn, startSession } from '$lib/services/additions/session';
export { additionsSetup } from '$lib/services/additions/setup.svelte';
export { checkForUpdate } from '$lib/services/additions/site-settings';
