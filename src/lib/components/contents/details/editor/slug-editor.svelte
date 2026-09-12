<script>
  import { _ } from '@sveltia/i18n';
  import { TextInput } from '@sveltia/ui';

  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { getEntryDraftContext } from '$lib/services/contents/draft/state.svelte';
  import { watch } from '$lib/services/utils/state.svelte';

  const entryDraft = getEntryDraftContext();

  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  const defaultLocale = $derived(entryDraft.current?.defaultLocale);
  const slugEditor = $derived(entryDraft.current?.slugEditor[locale]);
  const required = $derived(slugEditor === true);
  const readonly = $derived(slugEditor === 'readonly');
  const validity = $derived(entryDraft.current?.validities[locale]._slug);
  const invalid = $derived(!readonly && validity?.valid === false);

  let inputValue = $state('');

  $effect(() => {
    if (readonly) {
      inputValue = entryDraft.current?.currentSlugs[locale] ?? '';
    }
  });

  watch(
    () => inputValue,
    () => {
      const draft = entryDraft.current;

      if (draft) {
        // Update the slug for the current locale and for the other readonly locales
        Object.entries(draft.slugEditor).forEach(([_locale, enabled]) => {
          if (locale === _locale || (locale === defaultLocale && enabled === 'readonly')) {
            draft.currentSlugs[_locale] = inputValue;
          }
        });
      }
    },
  );
</script>

{#if entryDraft.current}
  <FieldEditorGroup>
    <header role="none">
      <h4 role="none" id="{fieldId}-label">{_('slug')}</h4>
      {#if required}
        <div class="required" aria-label={_('required')}>*</div>
      {/if}
    </header>
    {#if invalid}
      <ValidationError id="{fieldId}-error">
        {#if validity?.valueMissing}
          {_('edit_slug_error.empty')}
        {/if}
        {#if validity?.patternMismatch}
          {_('edit_slug_error.invalid')}
        {/if}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper">
      <TextInput
        dir="auto"
        bind:value={inputValue}
        flex
        {readonly}
        {required}
        {invalid}
        aria-labelledby="{fieldId}-label"
        aria-errormessage="{fieldId}-error"
      />
    </div>
  </FieldEditorGroup>
{/if}
