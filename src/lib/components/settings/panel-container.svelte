<script>
  import { Alert, Toast } from '@sveltia/ui';

  /**
   * @import { Component } from 'svelte';
   * @import { SettingsPanelOnChangeArgs } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {Component} [Panel] Panel component.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    Panel,
    /* eslint-enable prefer-const */
  } = $props();

  let toastMessage = $state('');
  /** @type {'success' | 'error'} */
  let toastStatus = $state('success');
  let showToast = $state(false);
</script>

<div class="container" role="none">
  <Panel
    onChange={(/** @type {SettingsPanelOnChangeArgs} */ { message, status }) => {
      toastMessage = message;
      toastStatus = status ?? 'success';
      showToast = true;
    }}
  />
</div>

<Toast bind:show={showToast}>
  <Alert status={toastStatus}>{toastMessage}</Alert>
</Toast>

<style lang="scss">
  .container {
    display: contents;

    :global {
      section:not(:first-child) {
        margin: 16px 0 0;
      }

      p {
        margin-top: 0;
      }

      h3 {
        font-size: inherit;

        & ~ div {
          margin: 8px 0 0;
        }

        & ~ p {
          margin: 8px 0 0;
          color: var(--sui-secondary-foreground-color);
          font-size: var(--sui-font-size-small);
        }
      }

      h4 {
        margin-bottom: 4px;
        font-size: var(--sui-font-size-small);
      }
    }
  }
</style>
