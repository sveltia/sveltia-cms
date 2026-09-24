<script>
  import { _ } from '@sveltia/i18n';
  import { TextInput } from '@sveltia/ui';

  import EditableText from '$lib/components/common/editable-text.svelte';
  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { getSlugOptions } from '$lib/services/contents/collection/slug';
  import { getSlugTargetLocales } from '$lib/services/contents/draft/create';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import {
    getSlugValidationMessage,
    getTakenSlugs,
    validateSlug,
  } from '$lib/services/contents/draft/validate/slugs';
  import { getSlugPreviews } from '$lib/services/contents/editor/slug';
  import { watch } from '$lib/services/utils/state.svelte';

  /**
   * @import { EntryDraft, EntryValidityState, InternalLocaleCode } from '$lib/types/private';
   */

  const entryDraft = getEntryDraftContext();

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Locale of the slug.
   * @property {string} [ariaLabelledby] ID of the element labelling the field, e.g. the heading of
   * a Slug panel section. Without it, the field has a heading of its own.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    ariaLabelledby = undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();
  const labelId = $derived(ariaLabelledby ?? `${fieldId}-label`);
  const slugEditor = $derived(entryDraft.current?.slugEditor[locale]);
  /**
   * The collection’s slug options. The slug editor is only shown in an entry collection, and
   * they’re only read while the editor is rendered, when the draft is there.
   */
  const slugOptions = $derived(
    getSlugOptions(/** @type {EntryDraft} */ (entryDraft.current).collection),
  );
  /**
   * Whether the slug comes from the slug editor alone, in which case it’s typed in a regular text
   * field. Otherwise, the slug the template fills is shown, and it can be edited if needed.
   */
  const required = $derived(slugEditor === true && slugOptions.editorRequired);
  const readonly = $derived(slugEditor === 'readonly');
  const validity = $derived(entryDraft.current?.validities[locale]._slug);
  const invalid = $derived(!readonly && validity?.valid === false);
  // Only read while the slug is invalid, when the validity is there
  const errorMessage = $derived(/** @type {EntryValidityState} */ (validity).customErrorMessage);
  /**
   * Slug in the draft. Besides the editor itself, it can be set before the editor is shown, e.g.
   * through the `_slug` URL parameter, or while it’s shown, by restoring a backup or reverting the
   * changes. An empty slug makes the entry follow the slug template until it’s saved.
   */
  const draftSlug = $derived(entryDraft.current?.currentSlugs[locale] ?? '');
  /**
   * Slug the template fills, which the entry is saved with unless another slug is given. There’s
   * none when the slug comes from the slug editor alone, e.g. in a read-only locale sharing the
   * default locale’s slug, which is shown once it’s typed in. It’s only read while the editor is
   * rendered, when the draft is there.
   */
  const templateSlug = $derived.by(() => {
    if (slugOptions.editorRequired) {
      return '';
    }

    const previews = getSlugPreviews(/** @type {EntryDraft} */ (entryDraft.current), {
      templateOnly: true,
    });

    return previews[locale] ?? previews._;
  });
  /**
   * Slug the entry would be saved with.
   */
  const shownSlug = $derived(draftSlug || templateSlug);

  let editing = $state(false);
  /** Slug being edited, or typed in the regular text field. */
  let text = $state('');

  /**
   * What stops the slug being edited from being used, checked as it’s typed. An empty slug is
   * fine, as it makes the entry follow the slug template again.
   */
  const editError = $derived.by(() => {
    if (!editing) {
      return undefined;
    }

    // The slug is only edited while the editor is rendered, when the draft is there
    const draft = /** @type {EntryDraft} */ (entryDraft.current);

    return validateSlug({
      slug: text,
      required: false,
      pattern: slugOptions.pattern,
      takenSlugs: getTakenSlugs(draft, [locale])[locale],
      locale,
    });
  });

  /**
   * Update the slug for the current locale and for the other readonly locales.
   * @param {string} slug New slug.
   */
  const updateSlug = (slug) => {
    const draft = entryDraft.current;

    /* v8 ignore next 3 -- the editor is only rendered while the draft is there */
    if (!draft) {
      return;
    }

    getSlugTargetLocales({
      slugEditor: draft.slugEditor,
      locale,
      defaultLocale: draft.defaultLocale,
    }).forEach((_locale) => {
      draft.currentSlugs[_locale] = slug;
    });
  };

  /**
   * Apply the edited slug. The slug the template fills is never written to the draft as is, so the
   * entry keeps following the template until it’s saved, with the date and a unique name of the
   * save.
   * @param {string} slug Edited slug.
   * @returns {boolean} Whether the editing ends, which it doesn’t while the slug is invalid.
   */
  const applySlug = (slug) => {
    if (editError) {
      return false;
    }

    if (slug !== shownSlug) {
      updateSlug(slug.trim());
    }

    return true;
  };

  // Keep the regular text field in sync with the draft, which can be updated elsewhere
  watch(
    () => draftSlug,
    () => {
      if (required && text !== draftSlug) {
        text = draftSlug;
      }
    },
  );
</script>

{#if entryDraft.current}
  <FieldEditorGroup>
    {#if !ariaLabelledby}
      <header role="none">
        <h4 role="none" id="{fieldId}-label">{_('slug')}</h4>
        {#if required}
          <span class="required" aria-hidden="true">*</span>
        {/if}
      </header>
    {/if}
    {#if editError}
      <ValidationError id="{fieldId}-error">
        {getSlugValidationMessage({ error: editError, pattern: slugOptions.pattern })}
      </ValidationError>
    {:else if invalid && !editing}
      <ValidationError id="{fieldId}-error">
        {errorMessage}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper">
      {#if required}
        <TextInput
          dir="auto"
          bind:value={text}
          oninput={() => {
            updateSlug(text);
          }}
          flex
          {required}
          {invalid}
          aria-labelledby={labelId}
          aria-errormessage="{fieldId}-error"
        />
      {:else}
        <EditableText
          id="{fieldId}-value"
          value={shownSlug}
          bind:editing
          bind:text
          canEdit={!readonly}
          editLabel={_('edit_slug')}
          placeholder={templateSlug}
          invalid={!!editError || (invalid && !editing)}
          applyDisabled={!!editError}
          ariaLabelledby={labelId}
          ariaErrormessage="{fieldId}-error"
          onApply={applySlug}
        />
      {/if}
    </div>
  </FieldEditorGroup>
{/if}
