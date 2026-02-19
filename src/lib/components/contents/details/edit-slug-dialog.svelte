<script>
  import { Alert, Dialog, TextInput } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { _ } from 'svelte-i18n';

  import { getEntriesByCollection } from '$lib/services/contents/collection/entries';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {boolean} [open] Whether the dialog is open.
   */

  /** @type {Props} */
  let { open = $bindable(false) } = $props();

  const collectionName = $derived($entryDraft?.collectionName ?? '');
  const currentSlugs = $derived($entryDraft?.currentSlugs ?? {});

  /** @type {string[]} */
  let otherSlugs = $state([]);
  /** @type {Record<InternalLocaleCode, string>} */
  const updatedSlugs = $state({});
  /** @type {Record<InternalLocaleCode, false | 'empty' | 'duplicate'>} */
  const validations = $state({});

  const componentId = $props.id();

  /**
   * Initialize the properties.
   */
  const init = () => {
    otherSlugs = getEntriesByCollection(collectionName)
      .map((entry) => Object.values(entry.locales).map(({ slug }) => slug))
      .flat(1)
      .filter((slug) => !Object.values(currentSlugs).includes(slug));
    Object.assign(updatedSlugs, currentSlugs);
    Object.assign(
      validations,
      Object.fromEntries(Object.keys(currentSlugs).map((locale) => [locale, false])),
    );
  };

  $effect(() => {
    if (open) {
      init();
    }
  });
</script>

<Dialog
  bind:open
  title={$_('edit_slug')}
  okLabel={$_('update')}
  okDisabled={equal(currentSlugs, updatedSlugs) ||
    Object.values(validations).some((invalid) => invalid !== false)}
  onOk={() => {
    /** @type {EntryDraft} */ ($entryDraft).currentSlugs = updatedSlugs;
  }}
>
  <Alert status="warning" --font-size="var(--sui-font-size-small)">
    {$_('edit_slug_warning')}
  </Alert>
  <div role="none" class="locales">
    {#each Object.keys(updatedSlugs) as locale}
      <section>
        {#if !['_', '_default'].includes(locale)}
          <div role="none">
            <h3>{getLocaleLabel(locale) ?? locale}</h3>
          </div>
        {/if}
        <div role="none">
          <TextInput
            flex
            bind:value={updatedSlugs[locale]}
            oninput={() => {
              validations[locale] = !updatedSlugs[locale].trim()
                ? 'empty'
                : otherSlugs.includes(updatedSlugs[locale])
                  ? 'duplicate'
                  : false;
            }}
            invalid={validations[locale] !== false}
            aria-errormessage="{componentId}-{locale}-error"
          />
          <p id="{componentId}-{locale}-error" class="error">
            {#if validations[locale] === 'empty'}
              {$_('edit_slug_error.empty')}
            {/if}
            {#if validations[locale] === 'duplicate'}
              {$_('edit_slug_error.duplicate')}
            {/if}
          </p>
        </div>
      </section>
    {/each}
  </div>
</Dialog>

<style lang="scss">
  p:not(:empty) {
    margin-top: 0;
  }

  .locales {
    display: table;
    margin: 16px 0 0;
    width: 100%;

    section {
      display: table-row;

      div {
        display: table-cell;
        vertical-align: middle;
        white-space: nowrap;

        &:last-child {
          width: 90%;
        }
      }

      h3 {
        margin-inline-end: 8px;
        font-size: inherit;
      }

      p.error {
        margin: 0;
        color: var(--sui-error-foreground-color);
        font-size: var(--sui-font-size-small);
      }
    }
  }
</style>
