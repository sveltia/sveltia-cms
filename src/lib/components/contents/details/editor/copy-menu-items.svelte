<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import { copyFromLocale } from '$lib/services/contents/draft/update';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { translator } from '$lib/services/integrations/translators';

  /**
   * @type {LocaleCode}
   */
  export let locale;
  /**
   * @type {LocaleCode[]}
   */
  export let otherLocales;
  /**
   * @type {FieldKeyPath}
   */
  export let keyPath = '';
  /**
   * @type {boolean}
   */
  export let translate = false;

  $: ({ currentLocales = {}, currentValues = {} } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ getSourceLanguage, getTargetLanguage } = $translator);
</script>

{#each otherLocales as otherLocale}
  <MenuItem
    label={$_(translate ? 'translate_from_x' : 'copy_from_x', {
      values: { locale: getLocaleLabel(otherLocale) },
    })}
    disabled={!currentLocales[locale] ||
      !currentLocales[otherLocale] ||
      (keyPath && !currentValues[otherLocale][keyPath]) ||
      (!translate &&
        keyPath &&
        currentValues[otherLocale][keyPath] === currentValues[locale][keyPath]) ||
      (translate && (!getSourceLanguage(locale) || !getTargetLanguage(otherLocale)))}
    onclick={() => {
      copyFromLocale(otherLocale, locale, { keyPath, translate });
    }}
  />
{/each}
