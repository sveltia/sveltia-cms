import { LocalStorage } from '@sveltia/utils/storage';

import { USER_STORAGE_KEY } from '$lib/services/user/constants';

/**
 * @import { User } from '$lib/types/private';
 */

/**
 * @type {{ account: User | null | undefined }}
 */
export const user = $state({ account: undefined });

$effect.root(() => {
  $effect(() => {
    const _user = user.account;

    (async () => {
      try {
        if (_user) {
          await LocalStorage.set(USER_STORAGE_KEY, _user);
        } else if (_user === null) {
          await LocalStorage.delete(USER_STORAGE_KEY);
        }
      } catch {
        //
      }
    })();
  });
});
