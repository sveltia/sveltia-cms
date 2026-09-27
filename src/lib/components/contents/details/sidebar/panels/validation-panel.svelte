<script>
  import { _ } from '@sveltia/i18n';
  import { Button } from '@sveltia/ui';

  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import PanelContainer from '$lib/components/contents/details/sidebar/panels/panel-container.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { validateEntry } from '$lib/services/contents/draft/validate';
  import { awaitCustomFieldValidations } from '$lib/services/contents/draft/validate/custom-fields';
  import { getInvalidFields } from '$lib/services/contents/draft/validate/messages';
  import { expandInvalidFields, highlightEditorField } from '$lib/services/contents/editor/fields';
  import { showSidebarPanel } from '$lib/services/contents/editor/sidebar';
  import { getLocaleLabel } from '$lib/services/contents/i18n';

  /**
   * @import { EntryDraft, InternalLocaleCode } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {typeof highlightEditorField} [onSelectField] Called when an invalid field is
   * selected. Defaults to highlighting the field in the editor.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    onSelectField = highlightEditorField,
    /* eslint-enable prefer-const */
  } = $props();

  const entryDraft = getEntryDraftContext();

  const { validationMessages, validities } = $derived(
    /** @type {EntryDraft} */ (entryDraft.current ?? {}),
  );

  const hasResults = $derived(
    Object.values(validities ?? {}).some((map) => !!Object.keys(map).length),
  );

  let validating = $state(false);

  /**
   * List the fields that have validation errors in the given locale.
   * @param {InternalLocaleCode} locale Locale code.
   * @returns {ReturnType<typeof getInvalidFields>} Invalid fields.
   */
  const listInvalidFields = (locale) =>
    // The results are only shown while the draft is there
    getInvalidFields({ draft: /** @type {EntryDraft} */ (entryDraft.current), locale });

  /**
   * Validate the entry on demand, so what’s left to do can be checked without attempting a save.
   * Every rule is applied, including the required fields that an Editorial Workflow draft can be
   * saved without: the question this answers is what stands between the entry and being published,
   * not whether it can be saved as it stands.
   */
  const validate = async () => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the panel is only shown while the draft is there, one check at a time */
    if (!draft || validating) {
      return;
    }

    validating = true;

    // Custom field validators can be async, so wait for any in-flight results, as a save does
    await awaitCustomFieldValidations();

    if (!validateEntry({ draft })) {
      expandInvalidFields({ draft });
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
      disabled={!entryDraft.current || validating}
      onclick={() => {
        validate();
      }}
    />
  {/snippet}
  {#if hasResults}
    {#each Object.keys(validationMessages) as locale (locale)}
      {@const label = getLocaleLabel(locale)}
      <section class="locale" role="group">
        {#if label}
          <h4>{label}</h4>
        {/if}
        {#if Object.values(validities[locale]).some((v) => v.valid === false)}
          {@const slugValidity = validities[locale]._slug}
          {#if slugValidity?.valid === false}
            <!-- The slug is edited in the Slug panel rather than in the editor -->
            <Button
              class="ref"
              variant="ghost"
              onclick={() => {
                showSidebarPanel('slug');
              }}
            >
              <span class="summary">{_('slug')}</span>
              <ValidationError live="off">
                {slugValidity.customErrorMessage}
              </ValidationError>
            </Button>
          {/if}
          {#each listInvalidFields(locale) as { keyPath, label: fieldLabel, messages } (keyPath)}
            <Button
              class="ref"
              variant="ghost"
              onclick={() => {
                onSelectField({ locale, keyPath });
              }}
            >
              <span class="summary">{fieldLabel}</span>
              {#each messages as message, index (index)}
                <ValidationError live="off">
                  {message}
                </ValidationError>
              {/each}
            </Button>
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
