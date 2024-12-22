<script>
  import { Button, Icon, Menu, MenuButton } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { copyFromLocale } from '$lib/services/contents/draft/update';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { translator } from '$lib/services/integrations/translators';

  /**
   * @typedef {object} Props
   * @property {'medium' | 'small'} [size] - Button size.
   * @property {LocaleCode} locale - Current pane’s locale.
   * @property {LocaleCode[]} otherLocales - Other locales.
   * @property {FieldKeyPath} [keyPath] - Field key path.
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

  const { getSourceLanguage, getTargetLanguage } = $derived($translator ?? {});
  const sourceDisabled = $derived(
    !$entryDraft?.currentLocales[locale] || !getSourceLanguage(locale),
  );
</script>

{#if otherLocales.length === 1}
  {@const [otherLocale] = otherLocales}
  {@const label = $_('translate_from_x', { values: { locale: getLocaleLabel(otherLocale) } })}
  <!-- @todo Replace the native tooltip -->
  <Button
    variant="ghost"
    {size}
    iconic
    popupPosition="bottom-right"
    aria-label={label}
    title={label}
    disabled={sourceDisabled ||
      !$entryDraft?.currentLocales[otherLocale] ||
      !getTargetLanguage(otherLocale)}
    onclick={() => {
      copyFromLocale(otherLocale, locale, { keyPath, translate: true });
    }}
  >
    {#snippet startIcon()}
      <Icon name="translate" />
    {/snippet}
  </Button>
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
