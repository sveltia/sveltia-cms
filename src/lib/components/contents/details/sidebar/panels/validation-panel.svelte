<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getField } from '$lib/services/contents/entry/fields';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   * @import { FieldKeyPath, VisibleField } from '$lib/types/public';
   */

  const { validationMessages, collectionName, fileName, currentValues, isIndexFile, validities } =
    $derived(/** @type {EntryDraft} */ ($entryDraft ?? {}));

  const hasResults = $derived(
    Object.values(validities ?? {}).some((map) => !!Object.keys(map).length),
  );

  const getFieldArgs = $derived({ collectionName, fileName, currentValues, isIndexFile });

  /**
   * Focuses the field in the editor corresponding to the given locale and key path.
   * @param {object} args Arguments.
   * @param {InternalLocaleCode} args.locale Locale code.
   * @param {FieldKeyPath} args.keyPath Key path of the field.
   */
  const focusField = ({ locale, keyPath }) => {
    window.postMessage({ type: 'highlight-editor-field', payload: { locale, keyPath } });
  };
</script>

<PanelContainer title={_('entry_sidebar.validation.title')}>
  {#if validities && hasResults}
    {#each Object.entries(validationMessages) as [locale, messagesByKey] (locale)}
      {@const valueMap = currentValues?.[locale]}
      {@const label = getLocaleLabel(locale)}
      <section class="locale" role="group">
        {#if label}
          <h4>{label}</h4>
        {/if}
        {#if Object.values(validities[locale]).some((v) => v.valid === false)}
          {#each Object.keys(valueMap) as keyPath (keyPath)}
            {@const field = getField({ ...getFieldArgs, valueMap, keyPath })}
            {@const messages = messagesByKey[keyPath] ?? []}
            {#if messages.length}
              <Button
                class="ref"
                variant="ghost"
                onclick={() => {
                  focusField({ locale, keyPath });
                }}
              >
                <span class="summary">
                  {/** @type {VisibleField} */ (field)?.label || field?.name}
                </span>
                {#each messages as message, index (index)}
                  <ValidationError live="off">
                    {message}
                  </ValidationError>
                {/each}
              </Button>
            {/if}
          {/each}
        {:else}
          <div class="empty">{_('entry_sidebar.validation.no_errors_found')}</div>
        {/if}
      </section>
    {/each}
  {:else}
    <div class="empty">{_('entry_sidebar.validation.placeholder')}</div>
  {/if}
</PanelContainer>

<style lang="scss">
  .locale {
    padding: 4px;

    &:not(:first-child) {
      border-top: 2px solid var(--sui-secondary-background-color);
    }

    h4,
    .empty {
      margin: 0 !important;
      padding: 12px;
    }

    .summary {
      display: block;
      color: var(--sui-secondary-foreground-color);
      font-size: var(--sui-font-size-small);
      font-weight: var(--sui-heading-font-weight);
    }

    :global {
      .sui.button.ref {
        flex-direction: column;
        align-items: flex-start;
        gap: 4px;
      }
    }
  }
</style>
