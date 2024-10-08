<script>
  import { Button, Icon, Menu, MenuButton } from '@sveltia/ui';
  import { _ } from 'svelte-i18n';
  import CopyMenuItems from '$lib/components/contents/details/editor/copy-menu-items.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { copyFromLocale } from '$lib/services/contents/draft/update';
  import { getLocaleLabel } from '$lib/services/contents/i18n';
  import { translator } from '$lib/services/integrations/translators';

  /**
   * @type {'medium' | 'small'}
   */
  export let size = 'medium';
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

  $: ({ currentLocales = {} } = $entryDraft ?? /** @type {EntryDraft} */ ({}));
  $: ({ getSourceLanguage, getTargetLanguage } = $translator ?? {});
  $: sourceDisabled = !currentLocales[locale] || !getSourceLanguage(locale);
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
    disabled={sourceDisabled || !currentLocales[otherLocale] || !getTargetLanguage(otherLocale)}
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
    {#snippet startIcon()}
      <Icon name="translate" />
    {/snippet}
    {#snippet popup()}
      <Menu aria-label={$_('translation_options')}>
        <CopyMenuItems {locale} {otherLocales} {keyPath} translate={true} />
      </Menu>
    {/snippet}
  </MenuButton>
{/if}
