<script>
  import { MenuItem } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import { entryDraft } from '$lib/services/contents/draft';
  import { copyFromLocale } from '$lib/services/contents/draft/update/copy';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { translator } from '$lib/services/integrations/translators';

  /**
   * @import { InternalLocaleCode, LanguagePair } from '$lib/types/private';
   * @import { FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {InternalLocaleCode[]} otherLocales Other locales.
   * @property {FieldKeyPath} [keyPath] Field key path.
   * @property {boolean} [translate] Whether to translate the field.
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

  /**
   * Check if a menu item should be disabled.
   * @param {LanguagePair} languages Language pair.
   * @returns {Promise<boolean>} Whether the menu item should be disabled.
   */
  const isMenuDisabled = async ({ sourceLanguage, targetLanguage }) =>
    !$entryDraft?.currentLocales[targetLanguage] ||
    !$entryDraft.currentLocales[sourceLanguage] ||
    (!!keyPath && !$state.snapshot($entryDraft.currentValues[sourceLanguage])[keyPath]) ||
    (!translate &&
      !!keyPath &&
      $state.snapshot($entryDraft.currentValues[sourceLanguage])[keyPath] ===
        $state.snapshot($entryDraft.currentValues[targetLanguage])[keyPath]) ||
    (translate && !(await $translator?.availability({ sourceLanguage, targetLanguage })));
</script>

{#each otherLocales as otherLocale}
  {@const languagePair = { sourceLanguage: otherLocale, targetLanguage: locale }}
  {#await isMenuDisabled(languagePair) then disabled}
    <MenuItem
      label={$_(translate ? 'translate_from_x' : 'copy_from_x', {
        values: { locale: getLocaleLabel(otherLocale) },
      })}
      {disabled}
      onclick={() => {
        copyFromLocale({ ...languagePair, keyPath, translate });
      }}
    />
  {/await}
{/each}
