<!--
  @component
  Toast telling the user how many fields have errors after a save or an addition failed validation.
  The entry editor toolbar and the Relation field’s quick add dialog both show it.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, Toast } from '@sveltia/ui';

  /**
   * @typedef {object} Props
   * @property {boolean} [show] Whether the toast is shown.
   * @property {number} count Number of invalid fields.
   * @property {() => void} [onShowErrors] Function called when the Show Errors button is clicked,
   * once the toast has been hidden. The button is only shown if this is given.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    show = $bindable(false),
    count,
    onShowErrors = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<Toast bind:show>
  <Alert status="error">
    {_('entry_validation_errors', { values: { count } })}
    {#if onShowErrors}
      <Button
        variant="secondary"
        size="small"
        label={_('show_errors')}
        onclick={() => {
          show = false;
          onShowErrors();
        }}
      />
    {/if}
  </Alert>
</Toast>
