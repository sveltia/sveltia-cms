<!--
  @component
  The list of Administration sections. On a small screen, it’s the whole page until a section is
  chosen, with a way back to the Menu page, which lists the sections too.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Icon, Listbox, Option, Toolbar } from '@sveltia/ui';

  import BackButton from '$lib/components/common/page-toolbar/back-button.svelte';
  import { getAdminSectionPath } from '$lib/services/app/admin';
  import { goBack, goto } from '$lib/services/app/navigation';
  import { env } from '$lib/services/user/env.svelte';

  /**
   * @import { AdminSection } from '$lib/services/app/admin';
   */

  /**
   * @typedef {object} Props
   * @property {AdminSection[]} sections Sections to list.
   * @property {string | undefined} selectedKey Key of the section shown, if any.
   */

  /** @type {Props} */
  let { sections, selectedKey } = $props();
</script>

<nav class="primary-sidebar" aria-label={_('administration')}>
  {#if env.isSmallScreen}
    <Toolbar variant="primary">
      <BackButton onclick={() => goBack('/menu')} />
      <h2 role="none">{_('administration')}</h2>
    </Toolbar>
  {/if}
  <!-- The sections are shown next to the list, except on a small screen -->
  <Listbox
    ariaLabel={_('administration')}
    aria-controls={env.isSmallScreen ? undefined : 'admin-container'}
  >
    {#each sections as { key, labelKey, icon } (key)}
      <Option
        selected={!env.isSmallScreen && key === selectedKey}
        label={_(labelKey)}
        onSelect={() => {
          goto(getAdminSectionPath(key), { transitionType: 'forwards' });
        }}
      >
        {#snippet startIcon()}
          <Icon name={icon} />
        {/snippet}
      </Option>
    {/each}
  </Listbox>
</nav>
