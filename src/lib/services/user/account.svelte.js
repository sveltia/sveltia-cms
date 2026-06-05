import { LocalStorage } from '@sveltia/utils/storage';

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
          await LocalStorage.set('sveltia-cms.user', _user);
        } else if (_user === null) {
          await LocalStorage.delete('sveltia-cms.user');
        }
      } catch {
        //
      }
    })();
  });
});
