import { derived, toStore, writable } from 'svelte/store';

import { backend } from '$lib/services/backends';
import { user } from '$lib/services/user/account.svelte';
import { env } from '$lib/services/user/env.svelte';

export const canShowMobileSignInDialog = derived(
  [
    toStore(() => env.isLargeScreen),
    toStore(() => env.hasMouse),
    toStore(() => env.isLocalHost),
    backend,
    toStore(() => user.account),
  ],
  ([_isLargeScreen, _hasMouse, _isLocalHost, _backend, _user]) =>
    _isLargeScreen && _hasMouse && !_isLocalHost && !!_backend?.isGit && !!_user?.token,
);

export const showMobileSignInDialog = writable(false);
