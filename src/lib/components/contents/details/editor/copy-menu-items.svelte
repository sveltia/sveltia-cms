<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import { entryDraft } from '$lib/services/contents/draft';
  import { copyFromLocale } from '$lib/services/contents/draft/update';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { translator } from '$lib/services/integrations/translators';

  /**
   * @typedef {object} Props
   * @property {LocaleCode} locale - Current pane’s locale.
   * @property {LocaleCode[]} otherLocales - Other locales.
   * @property {FieldKeyPath} [keyPath] - Field key path.
   * @property {boolean} [translate] - Whether to translate the field.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    otherLocales,
    keyPath = '',
    translate = false,
    /* eslint-enable prefer-const */
  } = $props();

  const { getSourceLanguage, getTargetLanguage } = $derived($translator);
</script>

{#each otherLocales as otherLocale}
  <MenuItem
    label={$_(translate ? 'translate_from_x' : 'copy_from_x', {
      values: { locale: getLocaleLabel(otherLocale) },
    })}
    disabled={!$entryDraft?.currentLocales[locale] ||
      !$entryDraft?.currentLocales[otherLocale] ||
      (keyPath && !$state.snapshot($entryDraft?.currentValues[otherLocale])[keyPath]) ||
      (!translate &&
        keyPath &&
        $state.snapshot($entryDraft?.currentValues[otherLocale])[keyPath] ===
          $state.snapshot($entryDraft?.currentValues[locale])[keyPath]) ||
      (translate && (!getSourceLanguage(locale) || !getTargetLanguage(otherLocale)))}
    onclick={() => {
      copyFromLocale(otherLocale, locale, { keyPath, translate });
    }}
  />
{/each}
