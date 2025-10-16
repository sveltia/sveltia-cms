<script>
  import { Button, Icon, Menu, MenuButton } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';

  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
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
   * @property {'medium' | 'small'} [size] Button size.
   * @property {InternalLocaleCode} locale Current pane’s locale.
   * @property {InternalLocaleCode[]} otherLocales Other locales.
   * @property {FieldKeyPath} [keyPath] Field key path.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    size = 'medium',
    locale,
    otherLocales,
    keyPath = '',
    /* eslint-enable prefer-const */
  } = $props();

  const sourceDisabled = $derived(!$entryDraft?.currentLocales[locale]);

  /**
   * Check if the translate button should be disabled.
   * @param {LanguagePair} languages Language pair.
   * @returns {Promise<boolean>} Whether the button should be disabled.
   */
  const isButtonDisabled = async ({ sourceLanguage, targetLanguage }) =>
    sourceDisabled ||
    !$entryDraft?.currentLocales[sourceLanguage] ||
    !(await $translator?.availability({ sourceLanguage, targetLanguage }));
</script>

{#if otherLocales.length === 1}
  {@const [otherLocale] = otherLocales}
  {@const label = $_('translate_from_x', {
    values: { locale: getLocaleLabel(otherLocale) ?? otherLocale },
  })}
  {@const languagePair = { sourceLanguage: otherLocale, targetLanguage: locale }}
  {#await isButtonDisabled(languagePair) then disabled}
    <!-- @todo Replace `title` with a native tooltip -->
    <Button
      variant="ghost"
      {size}
      iconic
      popupPosition="bottom-right"
      aria-label={label}
      title={label}
      {disabled}
      onclick={() => {
        copyFromLocale({ ...languagePair, keyPath, translate: true });
      }}
    >
      {#snippet startIcon()}
        <Icon name="translate" />
      {/snippet}
    </Button>
  {/await}
{:else}
  <MenuButton
    variant="ghost"
    {size}
    iconic
    popupPosition="bottom-right"
    aria-label={$_('translate')}
    disabled={sourceDisabled}
  >
    {#snippet endIcon()}
      <Icon name="translate" />
    {/snippet}
    {#snippet popup()}
      <Menu aria-label={$_('translation_options')}>
        <CopyMenuItems {locale} {otherLocales} {keyPath} translate={true} />
      </Menu>
    {/snippet}
  </MenuButton>
{/if}
