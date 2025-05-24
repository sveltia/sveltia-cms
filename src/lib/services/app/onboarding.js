import { derived, writable } from 'svelte/store';
import { backend } from '$lib/services/backends';
import { user } from '$lib/services/user';
import { hasMouse, isLargeScreen } from '$lib/services/user/env';

export const canShowMobileSignInDialog = derived(
  [isLargeScreen, hasMouse, backend, user],
  ([_isLargeScreen, _hasMouse, _backend, _user]) =>
    _isLargeScreen && _hasMouse && !!_backend?.isGit && !!_user?.token,
);

export const showMobileSignInDialog = writable(false);
