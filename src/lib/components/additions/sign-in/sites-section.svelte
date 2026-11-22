<!--
  @component
  The Other Sites view of the setup wizard, where whoever runs the service, e.g. an agency, adds and
  deletes the other sites it serves. The wizard lists them, and only offers this on the site served
  at the root of the service, which is the only one that can manage the others.
-->
<script>
  import { _ } from '@sveltia/i18n';
  import { Button, ConfirmationDialog, CopyButton, Icon, TextInput } from '@sveltia/ui';

  import ErrorMessage from '$lib/components/additions/common/error-message.svelte';
  import { TaskRunner } from '$lib/services/additions/task.svelte';
  import {
    createTenant,
    deleteTenant,
    isValidTenantId,
    MAX_TENANT_NAME_LENGTH,
  } from '$lib/services/additions/tenants';

  /**
   * @import { Tenant } from '$lib/services/additions/tenants';
   */

  /**
   * @typedef {object} Props
   * @property {Tenant[]} tenants Sites, as the wizard listed them, updated here as they’re added
   * and deleted.
   */

  /** @type {Props} */
  let { tenants = $bindable() } = $props();

  const runner = new TaskRunner();
  const { run } = runner;

  let id = $state('');
  let name = $state('');
  /** @type {Tenant | undefined} */
  let added = $state();
  /** Whether the clipboard refused the last URL copied, which is separate from the requests. */
  let copyFailed = $state(false);
  /**
   * Site to delete, kept after the confirmation closes, so its text doesn’t change while it fades
   * out.
   * @type {Tenant | undefined}
   */
  let deleting = $state();
  let showDeleteDialog = $state(false);
  let confirmId = $state('');

  const trimmedId = $derived(id.trim().toLowerCase());
  const trimmedName = $derived(name.trim());
  const confirmTarget = $derived(deleting?.id);

  /**
   * Add a site.
   * @param {SubmitEvent} event `submit` event.
   */
  const add = async (event) => {
    event.preventDefault();
    await run(async () => {
      const tenant = await createTenant({ id: trimmedId, name: trimmedName });

      // Listed by ID, as the service lists them
      tenants = [...tenants, tenant].sort((a, b) => Number(a.id > b.id) - Number(a.id < b.id));
      added = tenant;
      id = '';
      name = '';
    });
  };
</script>

<div role="group" aria-labelledby="additions-setup-sites">
  <h3 id="additions-setup-sites" tabindex="-1">{_('additions.setup.sites_title')}</h3>
  <p>{_('additions.setup.sites_description')}</p>
  {#if tenants.length}
    <ul>
      {#each tenants as tenant (tenant.id)}
        <li>
          <div role="none" class="site">
            <span class="name">{tenant.name}</span>
            <code>{tenant.url}</code>
          </div>
          <!-- Copied for the site’s CMS configuration; the button says when it’s done -->
          <CopyButton
            text={tenant.url}
            ariaLabel={_('additions.setup.copy_site_url', { values: { name: tenant.name } })}
            onCopy={() => {
              copyFailed = false;
            }}
            onError={() => {
              copyFailed = true;
            }}
          />
          <Button
            variant="ghost"
            iconic
            aria-label={_('additions.setup.delete_site_x', { values: { name: tenant.name } })}
            disabled={runner.busy}
            onclick={() => {
              deleting = tenant;
              showDeleteDialog = true;
              confirmId = '';
            }}
          >
            {#snippet startIcon()}
              <Icon name="delete" />
            {/snippet}
          </Button>
        </li>
      {/each}
    </ul>
  {:else}
    <p>{_('additions.setup.no_sites')}</p>
  {/if}
  {#if added}
    <p role="status">
      {_('additions.setup.site_added', { values: { name: added.name } })}
    </p>
  {/if}
  <form onsubmit={add}>
    <TextInput
      bind:value={id}
      ariaLabel={_('additions.setup.site_id')}
      showLabelAbove
      autocomplete="off"
      autocapitalize="none"
      spellcheck="false"
      aria-describedby="additions-setup-site-id"
    />
    <p id="additions-setup-site-id" class="note">{_('additions.setup.site_id_description')}</p>
    <TextInput
      bind:value={name}
      ariaLabel={_('additions.setup.site_name_optional')}
      showLabelAbove
      maxlength={MAX_TENANT_NAME_LENGTH}
      autocomplete="off"
    />
    <Button
      type="submit"
      variant="secondary"
      label={_('additions.setup.add_site')}
      disabled={!isValidTenantId(trimmedId) || runner.busy}
    />
  </form>
</div>
<ErrorMessage message={runner.error} />
<ErrorMessage message={copyFailed ? _('clipboard_error') : ''} />

<ConfirmationDialog
  bind:open={showDeleteDialog}
  title={_('additions.setup.delete_site')}
  okLabel={_('additions.setup.delete_site')}
  okDisabled={confirmId.trim() !== confirmTarget}
  onOk={() => {
    const { id: tenantId } = /** @type {Tenant} */ (deleting);

    run(async () => {
      await deleteTenant(tenantId);
      tenants = tenants.filter((tenant) => tenant.id !== tenantId);

      if (added?.id === tenantId) {
        added = undefined;
      }
    });
  }}
>
  <p>
    {_('additions.setup.delete_site_confirmation', {
      // The dialog is only opened with a site to delete
      values: { name: /** @type {Tenant} */ (deleting).name, id: confirmTarget },
    })}
  </p>
  <TextInput
    bind:value={confirmId}
    ariaLabel={_('additions.setup.site_id_to_confirm')}
    showLabelAbove
    autocomplete="off"
    autocapitalize="none"
    spellcheck="false"
  />
</ConfirmationDialog>

<style>
  [role='group'],
  form {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  h3,
  p {
    margin: 0;
  }

  h3 {
    font-size: var(--sui-font-size-large);
  }

  ul {
    margin: 0;
    padding: 0;
    list-style: none;
  }

  li {
    display: flex;
    align-items: center;
    gap: 4px;
    border-bottom: 1px solid var(--sui-secondary-border-color);
    padding: 8px 0;
  }

  .site {
    display: flex;
    flex: auto;
    flex-direction: column;
    min-width: 0;

    code {
      overflow: hidden;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }

  .name {
    font-weight: var(--sui-font-weight-bold, bold);
  }

  /* Close to the field it explains, rather than a full gap away, and lined up with its edge */
  .note {
    margin: -8px var(--sui-focus-ring-width) 0;
    color: var(--sui-secondary-foreground-color);
    font-size: var(--sui-font-size-small);
  }

  form > :global(.button),
  form > :global(.text-input) {
    width: 100%;
  }

  p + :global(.text-input) {
    margin-top: 12px;
  }
</style>
