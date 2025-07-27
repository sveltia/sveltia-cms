<script>
  import { Icon, MenuButton } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import AccountMenu from '$lib/components/global/toolbar/items/account-menu.svelte';
  import { user } from '$lib/services/user';

  /** @type {MenuButton | undefined} */
  let menuButton = $state();

  const hasAvatar = $derived(!!$user?.avatarURL);
</script>

<div role="none" class="wrapper">
  <MenuButton
    variant="ghost"
    iconic
    class={hasAvatar ? 'avatar' : ''}
    popupPosition="bottom-right"
    aria-label={$_('show_account_menu')}
    bind:this={menuButton}
  >
    {#snippet endIcon()}
      {#if hasAvatar}
        <img class="avatar" loading="lazy" src={$user?.avatarURL} alt="" />
      {:else}
        <Icon name={'account_circle'} />
      {/if}
    {/snippet}
    {#snippet popup()}
      <AccountMenu {menuButton} />
    {/snippet}
  </MenuButton>
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    :global {
      button.avatar {
        border-width: 0;
        background-color: transparent;
      }
    }
  }

  .avatar {
    width: 32px;
    height: 32px;
    border-radius: 32px;
    object-fit: cover;
  }
</style>
