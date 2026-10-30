<script>
  import ApiKeyInput from '$lib/components/settings/controls/api-key-input.svelte';
  import { makeLink } from '$lib/services/utils/string';

  /**
   * @import {
   * MediaLibraryService,
   * SettingsPanelOnChangeArgs,
   * TranslationService,
   * } from '$lib/types/private';
   */

  /**
   * @typedef {object} Props
   * @property {string} title Section heading.
   * @property {string} description Description shown below the heading. Its `<a>` tag links to
   * `docsURL`.
   * @property {string} docsURL URL of the relevant documentation.
   * @property {[string, MediaLibraryService | TranslationService][]} entries Services listed in the
   * section, as `[serviceId, service]` pairs.
   * @property {(serviceLabel: string) => string} getFieldLabel Function to get the accessible label
   * of the API key input for the given service label.
   * @property {(detail: SettingsPanelOnChangeArgs) => void} [onChange] `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    title,
    description,
    docsURL,
    entries,
    getFieldLabel,
    onChange = undefined,
    /* eslint-enable prefer-const */
  } = $props();
</script>

<section>
  <h3>{title}</h3>
  <p>
    {@html makeLink(description, docsURL)}
  </p>
  {#each entries as [serviceId, service] (serviceId)}
    {@const label = service.serviceLabel}
    <section>
      <h4>{label}</h4>
      <div role="none">
        <ApiKeyInput {serviceId} {service} ariaLabel={getFieldLabel(label)} {onChange} />
      </div>
    </section>
  {/each}
</section>
