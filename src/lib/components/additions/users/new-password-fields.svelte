<!--
  @component
  The field to choose a new password, with what’s wrong with it, if anything. It isn’t typed twice:
  the field can show what has been typed instead. A request error, e.g. from saving the password,
  can be shown in the same place.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { PasswordInput } from '@sveltia/ui';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';

  /**
   * @typedef {object} Props
   * @property {string} newPassword New password.
   * @property {'' | 'password_too_short'} passwordError Problem with the new password, from
   * `getNewPasswordError()`.
   * @property {string} [requestError] Error to show when the new password itself is fine.
   */

  /** @type {Props} */
  let { newPassword = $bindable(), passwordError, requestError = '' } = $props();
</script>

<PasswordInput
  bind:value={newPassword}
  ariaLabel={_('additions.new_password')}
  showLabelAbove
  autocomplete="new-password"
  invalid={!!passwordError}
/>
<ErrorMessage message={passwordError ? _(`additions.${passwordError}`) : requestError} />
