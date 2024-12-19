<script>
  import { Button, Icon } from '@sveltia/ui';
  import { generateElementId } from '@sveltia/utils/element';
  import { onMount } from 'svelte';
  import { _ } from 'svelte-i18n';
  import { editors } from '$lib/components/contents/details/widgets';

  /**
   * Field label.
   * @type {string}
   */
  export let label;
  /**
   * Subfield definitions.
   * @type {Field[]}
   */
  export let fields;
  /**
   * Value map.
   * @type {Record<string, any>}
   */
  export let values;
  /**
   * Custom `change` event handler.
   * @type {(event: CustomEvent) => void}
   */
  export let onChange = () => undefined;

  const supportedWidgets = ['image', 'string'];

  /** @type {HTMLElement | undefined} */
  let wrapper;
  let locale = '';
  let keyPath = '';

  /**
   * Get the wrapper element.
   * @returns {HTMLElement | undefined} Wrapper.
   */
  export const getElement = () => wrapper;

  onMount(() => {
    window.requestAnimationFrame(() => {
      locale = /** @type {string} */ (
        /** @type {HTMLElement} */ (wrapper?.closest('[data-locale]'))?.dataset.locale
      );
      keyPath = /** @type {string} */ (
        /** @type {HTMLElement} */ (wrapper?.closest('[data-key-path]'))?.dataset.keyPath
      );
    });
  });

  $: {
    onChange(new CustomEvent('update', { detail: values }));
  }
</script>

<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
<div
  role="group"
  class="wrapper"
  bind:this={wrapper}
  contenteditable="false"
  tabindex="0"
  aria-label={label}
  onkeydown={(event) => {
    if (
      !(/** @type {HTMLElement} */ (event.target)?.matches('button, input, textarea')) &&
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
    {#each fields as { name, label: fieldLabel, widget } (name)}
      {#if widget && supportedWidgets.includes(widget)}
        <section
          role="group"
          class="field"
          aria-label={$_('x_field', { values: { field: fieldLabel } })}
          data-widget={widget}
          data-key-path="{keyPath}:{name}"
        >
          <header role="none">
            <h4 role="none">{fieldLabel}</h4>
          </header>
          <div role="none" class="widget-wrapper">
            <svelte:component
              this={editors[widget]}
              {locale}
              keyPath="{keyPath}:{name}"
              fieldId={generateElementId('field')}
              fieldLabel={fieldLabel ?? name}
              fieldConfig={{ name, widget }}
              inEditorComponent={true}
              bind:currentValue={values[name]}
            />
          </div>
        </section>
      {/if}
    {/each}
  {/if}
</div>

<style lang="scss">
  .wrapper {
    border: 1px solid var(--sui-secondary-border-color);
    border-radius: 4px;
    background-color: var(--sui-primary-background-color);
    white-space: normal;
    -webkit-user-select: none;
    user-select: none;

    &:focus {
      outline-color: var(--sui-primary-accent-color-translucent);
    }

    &:not(:first-child) {
      margin-top: var(--sui-paragraph-margin);
    }

    &:not(:last-child) {
      margin-bottom: var(--sui-paragraph-margin);
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
  }

  section {
    margin: 0;
    border-top: 1px solid var(--sui-secondary-border-color);
    padding: 16px;

    h4 {
      margin-bottom: 8px;
      font-size: var(--sui-font-size-small);
      font-weight: 600;
      color: var(--sui-secondary-foreground-color);
    }
  }
</style>
