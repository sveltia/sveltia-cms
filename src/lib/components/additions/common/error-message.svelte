<!--
  @component
  Why a request to Sveltia CMS Additions failed, or what’s wrong with a form, announced as an alert.
  Nothing is shown without a message.
-->
<script>
  /**
   * @typedef {object} Props
   * @property {string} [message] Error message.
   */

  /** @type {Props} */
  let { message = '' } = $props();
</script>

{#if message}
  <div role="alert" class="error">{message}</div>
{/if}

<style>
  .error {
    color: var(--sui-error-foreground-color);
  }
</style>
