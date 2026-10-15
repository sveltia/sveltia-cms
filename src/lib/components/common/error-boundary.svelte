<!--
  @component
  Catch an error thrown while the content is rendered or in one of its effects, and show a message
  in its place, so a bug or unexpected data takes down only that part of the UI rather than leaving
  a blank page. An error thrown in an event handler or after an `await` isn’t caught.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Alert, Button, EmptyState } from '@sveltia/ui';

  import { describeError } from '$lib/services/utils/error';

  /**
   * @import { Snippet } from 'svelte';
   */

  /**
   * @typedef {object} Props
   * @property {'page' | 'field'} [scope] What the content is. A page gets a full-size message with
   * a button to reload the CMS, as the app may be left in a state it can’t recover from; a field
   * gets an inline message.
   * @property {Snippet} children Content.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    scope = 'field',
    children,
    /* eslint-enable prefer-const */
  } = $props();

  /* v8 ignore start -- reloading the page would tear the test down */
  /**
   * Reload the CMS, which starts it over from a clean state.
   */
  const reload = () => {
    window.location.reload();
  };
  /* v8 ignore stop */
</script>

<svelte:boundary
  onerror={(error) => {
    // eslint-disable-next-line no-console
    console.error(error);
  }}
>
  {@render children()}

  {#snippet failed(error, reset)}
    {@const message = _(`${scope}_crashed`, { values: { message: describeError(error) } })}
    {#if scope === 'page'}
      <EmptyState>
        <span role="alert">{message}</span>
        <div role="none" class="buttons">
          <Button variant="secondary" label={_('try_again')} onclick={reset} />
          <Button variant="primary" label={_('reload_cms')} onclick={reload} />
        </div>
      </EmptyState>
    {:else}
      <!-- The field preview highlights the field in the editor when it’s clicked or Enter is
      pressed, which the button mustn’t do as well. Other keys, like Escape, are left to their
      shortcuts -->
      <!-- svelte-ignore a11y_no_static_element_interactions -->
      <div
        role="none"
        class="field-error"
        onclick={(event) => event.stopPropagation()}
        onkeydown={(event) => {
          if (event.key === 'Enter') {
            event.stopPropagation();
          }
        }}
      >
        <Alert status="error">{message}</Alert>
        <Button variant="tertiary" size="small" label={_('try_again')} onclick={reset} />
      </div>
    {/if}
  {/snippet}
</svelte:boundary>

<style>
  .buttons {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
  }

  .field-error {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 8px;
  }
</style>
