import { LocalStorage } from '@sveltia/utils/storage';
import { writable } from 'svelte/store';

/**
 * @import { Writable } from 'svelte/store';
 * @import { User } from '$lib/typedefs/private';
 */

/**
 * @type {Writable<User | null | undefined>}
 */
export const user = writable();

user.subscribe((_user) => {
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
