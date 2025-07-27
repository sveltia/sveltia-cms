<script>
  import { Icon, Option } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { announcedPageStatus, goto } from '$lib/services/app/navigation';

  /**
   * @import { CollectionFile } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {CollectionFile} file The singleton file to display.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    file,
    /* eslint-enable prefer-const */
  } = $props();

  const { name, label, icon } = $derived(file);

  /** @type {boolean} */
  let selected = $state(false);
  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
</script>

<div class="wrapper" bind:this={wrapper}>
  <Option
    bind:selected
    label={label || name}
    onSelect={() => {
      // Announce the selected singleton file. The Content Editor will not open until
      // the user presses Enter.
      $announcedPageStatus = $_('singleton_selected_announcement', {
        values: { file: label || name },
      });
    }}
    onclick={() => {
      goto(`/collections/_singletons/entries/${name}`, { transitionType: 'forwards' });
      // Reset the selected state and remove the focused class from the option
      // @todo Handle this in Sveltia UI
      selected = false;
      wrapper?.querySelector('[role="option"]')?.classList.remove('focused');
    }}
  >
    {#snippet startIcon()}
      <Icon name={icon || 'edit_document'} />
    {/snippet}
  </Option>
</div>

<style lang="scss">
  .wrapper {
    display: contents;
  }
</style>
