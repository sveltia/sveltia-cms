<script>
  import { TextInput } from '@sveltia/ui';
  import { untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import FieldEditorGroup from '$lib/components/contents/details/editor/field-editor-group.svelte';
  import ValidationError from '$lib/components/contents/details/editor/validation-error.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { DEFAULT_I18N_CONFIG } from '$lib/services/contents/i18n/config';

  let {
    /* eslint-disable prefer-const */
    locale,
    /* eslint-enable prefer-const */
  } = $props();

  const fieldId = $props.id();

  const collection = $derived($entryDraft?.collection);
  const collectionFile = $derived($entryDraft?.collectionFile);
  const { defaultLocale } = $derived((collectionFile ?? collection)?._i18n ?? DEFAULT_I18N_CONFIG);
  const slugEditor = $derived($entryDraft?.slugEditor[locale]);
  const required = $derived(slugEditor === true);
  const readonly = $derived(slugEditor === 'readonly');
  const validity = $derived($entryDraft?.validities[locale]._slug);
  const invalid = $derived(!readonly && validity?.valid === false);

  let inputValue = $state('');

  $effect(() => {
    void [inputValue];

    untrack(() => {
      if ($entryDraft) {
        // Update the slug for the current locale and for the other readonly locales
        Object.entries($entryDraft.slugEditor).forEach(([_locale, enabled]) => {
          if (locale === _locale || (locale === defaultLocale && enabled === 'readonly')) {
            $entryDraft.currentSlugs[_locale] = inputValue;
          }
        });
      }
    });
  });

  $effect(() => {
    if (readonly) {
      inputValue = $entryDraft?.currentSlugs[locale] ?? '';
    }
  });
</script>

{#if $entryDraft}
  <FieldEditorGroup>
    <header role="none">
      <h4 role="none" id="{fieldId}-label">{$_('slug')}</h4>
      {#if required}
        <div class="required" aria-label={$_('required')}>*</div>
      {/if}
    </header>
    {#if invalid}
      <ValidationError id="{fieldId}-error">
        {#if validity?.valueMissing}
          {$_('validation.value_missing')}
        {/if}
      </ValidationError>
    {/if}
    <div role="none" class="field-wrapper">
      <TextInput
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
