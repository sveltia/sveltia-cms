<script>
  import { Button, Icon } from '@sveltia/ui';
  import equal from 'fast-deep-equal';
  import { flatten, unflatten } from 'flat';
  import { onMount, untrack } from 'svelte';
  import { _ } from 'svelte-i18n';

  import VisibilityObserver from '$lib/components/common/visibility-observer.svelte';
  import FieldEditor from '$lib/components/contents/details/editor/field-editor.svelte';
  import { entryDraft } from '$lib/services/contents/draft';
  import { getDefaultValues } from '$lib/services/contents/draft/defaults';

  /**
   * @import { DraftValueStoreKey, InternalLocaleCode, RawEntryContent } from '$lib/types/private';
   * @import { Field, FieldKeyPath } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {string} componentName Markdown editor component name.
   * @property {string} label Field label.
   * @property {Field[]} fields Subfield definitions.
   * @property {Record<string, any> | undefined} values Value map.
   * @property {(event: CustomEvent) => void} [onChange] Custom `change` event handler.
   */

  /** @type {Props} */
  let {
    /* eslint-disable prefer-const */
    componentName,
    label,
    fields,
    values,
    onChange = () => undefined,
    /* eslint-enable prefer-const */
  } = $props();

  const randomId = $props.id();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  /** @type {InternalLocaleCode} */
  let locale = $state('');
  /** @type {FieldKeyPath} */
  let keyPath = $state('');

  const keyPathPrefix = $derived(!keyPath ? '' : `${keyPath}:${randomId}:`);

  /**
   * Get the wrapper element.
   * @returns {HTMLElement | undefined} Wrapper.
   */
  export const getElement = () => wrapper;

  /**
   * Key to store the current values in the {@link entryDraft}. Usually `currentValues`, but we use
   * `extraValues` here to store additional values for a Markdown editor component.
   * @type {DraftValueStoreKey}
   */
  const valueStoreKey = 'extraValues';

  /**
   * Current values for the editor component. These Values are stored in the {@link entryDraft}
   * under the `extraValues` key, with the key path prefixed with the parent field’s key path, e.g.
   * `body:c12:image`.
   * @type {RawEntryContent | undefined}
   */
  const currentValues = $derived.by(() => {
    if (!($entryDraft && locale && keyPath)) {
      return undefined;
    }

    return unflatten(
      Object.fromEntries(
        Object.entries($state.snapshot($entryDraft[valueStoreKey][locale] ?? {}))
          .filter(([key]) => key.startsWith(keyPathPrefix))
          .map(([key, value]) => [key.replace(keyPathPrefix, ''), value]),
      ),
    );
  });

  onMount(() => {
    window.requestAnimationFrame(() => {
      locale = /** @type {string} */ (
        /** @type {HTMLElement} */ (wrapper?.closest('[data-locale]'))?.dataset.locale
      );
      keyPath = /** @type {string} */ (
        /** @type {HTMLElement} */ (wrapper?.closest('[data-key-path]'))?.dataset.keyPath
      );
    });

    return () => {
      // Remove the values from the draft when the component is unmounted
      if ($entryDraft && valueStoreKey === 'extraValues') {
        Object.keys($entryDraft[valueStoreKey][locale] ?? {}).forEach((key) => {
          if (key.startsWith(keyPathPrefix)) {
            delete $entryDraft[valueStoreKey][locale][key];
          }
        });
      }
    };
  });

  $effect(() => {
    void [values, locale, keyPath];

    untrack(() => {
      if ($entryDraft && locale && keyPath) {
        values ??= unflatten(getDefaultValues(fields, locale)) ?? {};
        values.__sc_component_name = componentName;

        if (!equal(values, currentValues)) {
          Object.assign(
            $entryDraft[valueStoreKey][locale],
            Object.fromEntries(
              Object.entries(flatten(values)).map(([key, value]) => [
                `${keyPathPrefix}${key}`,
                value,
              ]),
            ),
          );
        }
      }
    });
  });

  $effect(() => {
    onChange(new CustomEvent('update', { detail: currentValues }));
  });
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  role="group"
  class="wrapper"
  bind:this={wrapper}
  contenteditable="false"
  tabindex="0"
  aria-label={label}
  data-component-name={componentName}
  onkeydowncapture={(event) => {
    // Allow to select all in any `TextInput` within the component below using Ctrl+A
    event.stopPropagation();
  }}
  onkeydown={(event) => {
    if (
      !(/** @type {HTMLElement} */ (event.target).matches('button, input, textarea')) &&
      event.key !== 'Tab'
    ) {
      event.preventDefault();
    }

    if (event.target === wrapper && event.key === 'Backspace') {
      onChange(new CustomEvent('remove'));
    }
  }}
>
  <header role="none">
    <h3 role="none">{label}</h3>
    <Button
      size="small"
      iconic
      aria-label={$_('remove')}
      onclick={() => {
        onChange(new CustomEvent('remove'));
      }}
    >
      {#snippet startIcon()}
        <Icon name="close" />
      {/snippet}
    </Button>
  </header>
  {#if locale && keyPath}
    {#each fields as fieldConfig (fieldConfig.name)}
      <VisibilityObserver>
        <FieldEditor
          {locale}
          keyPath="{keyPathPrefix}{fieldConfig.name}"
          {fieldConfig}
          context="markdown-editor-component"
          {valueStoreKey}
        />
      </VisibilityObserver>
    {/each}
  {/if}
</div>

<style lang="scss">
  .wrapper {
    display: inline-block; // Cancel underline if the component is within a link
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: 4px;
    width: 100%;
    color: var(--sui-secondary-foreground-color); // Reset color within a link
    background-color: var(--sui-primary-background-color);
    white-space: normal;
    -webkit-user-select: none;
    user-select: none;

    &:focus {
      outline-color: var(--sui-primary-accent-color-translucent);
    }

    & > header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      color: var(--sui-secondary-foreground-color);
      background-color: var(--sui-selected-background-color);

      h3 {
        padding: 0 8px;
        font-size: var(--sui-font-size-small);
        font-weight: 600;
      }

      :global(button) {
        padding: 0;
        height: 16px;
      }
    }

    // Make the input fields compact within the built-in image component
    &:is([data-component-name='image'], [data-component-name='linked-image']) {
      :global {
        @media (768px <= width) {
          [data-widget] {
            border-width: 0;
          }

          [data-widget='string'] {
            display: flex;
            align-items: center;
            gap: 8px;
            padding-block: 0 16px;

            h4 {
              margin-bottom: 0 !important;
            }

            .widget-wrapper {
              flex: auto;
            }
          }
        }
      }
    }
  }
</style>
