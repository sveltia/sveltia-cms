<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { validateEntry } from '$lib/services/contents/draft/validate';
  import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
  import { expandInvalidFields, highlightEditorField } from '$lib/services/contents/editor/fields';
  import { getField } from '$lib/services/contents/entry/fields';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryDraft } from '$lib/types/private';
   * @import { VisibleField } from '$lib/types/public';
   */

  const { validationMessages, collectionName, fileName, currentValues, isIndexFile, validities } =
    $derived(/** @type {EntryDraft} */ ($entryDraft ?? {}));

  const hasResults = $derived(
    Object.values(validities ?? {}).some((map) => !!Object.keys(map).length),
  );

  const getFieldArgs = $derived({ collectionName, fileName, currentValues, isIndexFile });

  let validating = $state(false);

  /**
   * Validate the entry on demand, so what’s left to do can be checked without attempting a save.
   * Every rule is applied, including the required fields that an Editorial Workflow draft can be
   * saved without: the question this answers is what stands between the entry and being published,
   * not whether it can be saved as it stands.
   */
  const validate = async () => {
    const draft = $entryDraft;

    if (!draft || validating) {
      return;
    }

    validating = true;

    // Custom field validators can be async, so wait for any in-flight results, as a save does
    await awaitCustomFieldValidations();

    if (!validateEntry()) {
      expandInvalidFields({
        collectionName: draft.collectionName,
        fileName: draft.fileName,
        currentValues: draft.currentValues,
      });
    }

    validating = false;
  };
</script>

<PanelContainer title={_('entry_sidebar.validation.title')}>
  {#snippet actions()}
    <Button
      variant="tertiary"
      size="small"
      label={_('entry_sidebar.validation.validate')}
      disabled={!$entryDraft || validating}
      onclick={() => {
        validate();
      }}
    />
  {/snippet}
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
                  highlightEditorField({ locale, keyPath });
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

<style>
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
