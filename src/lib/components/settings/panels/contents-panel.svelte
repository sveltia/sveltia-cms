<script>
  import { TextInput } from '@sveltia/ui';
  import DOMPurify from 'isomorphic-dompurify';
  import { _ } from 'svelte-i18n';
  import PrefSwitch from '$lib/components/settings/controls/pref-switch.svelte';
  import { siteConfig } from '$lib/services/config';
  import { allTranslationServices } from '$lib/services/integrations/translators';
  import { prefs } from '$lib/services/user/prefs';

  /**
   * @typedef {object} Props
   * @property {(detail: { message: string }) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const, no-unused-vars */
    onChange = undefined,
    /* eslint-enable prefer-const, no-unused-vars */
  } = $props();
</script>

<section>
  <h4>{$_('prefs.contents.editor.title')}</h4>
  <div role="none">
    <PrefSwitch
      key="useDraftBackup"
      label={$_('prefs.contents.editor.use_draft_backup.switch_label')}
    />
  </div>
  <div role="none">
    <PrefSwitch key="closeOnSave" label={$_('prefs.contents.editor.close_on_save.switch_label')} />
  </div>
  <div role="none">
    <PrefSwitch
      key="closeWithEscape"
      label={$_('prefs.contents.editor.close_with_escape.switch_label')}
    />
  </div>
</section>
{#if ($siteConfig?.i18n?.locales?.length ?? 0) > 1}
  {#each Object.entries(allTranslationServices) as [serviceId, service] (serviceId)}
    {@const { serviceLabel, developerURL, apiKeyURL } = service}
    <section>
      <h4>{$_('prefs.contents.translator.title', { values: { service: serviceLabel } })}</h4>
      <p>
        {@html DOMPurify.sanitize(
          $_('prefs.contents.translator.description', {
            values: {
              service: serviceLabel,
              homeHref: `href="${developerURL}"`,
              apiKeyHref: `href="${apiKeyURL}"`,
            },
          }),
          { ALLOWED_TAGS: ['a'], ALLOWED_ATTR: ['href', 'target', 'rel'] },
        )}
      </p>
      <div role="none">
        {#if $prefs.apiKeys}
          <TextInput
            bind:value={$prefs.apiKeys[serviceId]}
            flex
            spellcheck="false"
            aria-label={$_('prefs.contents.translator.field_label', {
              values: { service: serviceLabel },
            })}
            onchange={() => {
              onChange?.({
                message: $_(
                  $prefs.apiKeys?.[serviceId]
                    ? 'prefs.changes.api_key_saved'
                    : 'prefs.changes.api_key_removed',
                ),
              });
            }}
          />
        {/if}
      </div>
    </section>
  {/each}
{/if}
