<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
-->
<script>
  import { TextEditor } from '@sveltia/ui';
  import { sleep } from '@sveltia/utils/misc';
  import { untrack } from 'svelte';
  import {
    EditorComponent,
    getComponentDef,
  } from '$lib/services/contents/widgets/markdown/component';
  import {
    buttonNameMap,
    defaultButtons,
    defaultComponents,
    defaultModes,
    modeNameMap,
    registeredComponents,
  } from '$lib/services/contents/widgets/markdown';

  /**
   * @typedef {object} Props
   * @property {MarkdownField} fieldConfig - Field configuration.
   * @property {string} [currentValue] - Field value.
   */

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  let inputValue = $state('');

  const allComponents = [...defaultComponents, ...registeredComponents.map((c) => c.id)];

  const {
    // Widget-specific options
    modes = [...defaultModes],
    buttons = [...defaultButtons],
    editor_components: editorComponents = [...allComponents],
    minimal = false,
  } = $derived(fieldConfig);
  const components = $derived(
    editorComponents
      .map((name) => {
        const componentDef =
          registeredComponents.find((c) => c.id === name) ?? getComponentDef(name);

        if (componentDef) {
          return /** @type {import('@sveltia/ui').TextEditorComponent} */ (
            new EditorComponent(componentDef)
          );
        }

        return undefined;
      })
      .filter((component) => !!component),
  );

  /**
   * Update {@link inputValue} based on {@link currentValue} while avoiding a cycle dependency.
   */
  const setInputValue = () => {
    const newValue = typeof currentValue === 'string' ? currentValue : '';

    if (inputValue !== newValue) {
      inputValue = newValue;
    }
  };

  /**
   * Update {@link currentValue} based on {@link inputValue} while avoiding a cycle dependency.
   */
  const setCurrentValue = () => {
    const newValue = inputValue;

    if (currentValue !== newValue) {
      currentValue = newValue;
    }
  };

  $effect(() => {
    void currentValue;

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    void inputValue;

    untrack(() => {
      setCurrentValue();
    });
  });
</script>

<div role="none" class="wrapper" class:minimal>
  {#await sleep(0) then}
    <TextEditor
      lang={locale}
      modes={modes.map((name) => modeNameMap[name]).filter(Boolean)}
      buttons={buttons.map((name) => buttonNameMap[name]).filter(Boolean)}
      {components}
      bind:value={inputValue}
      flex
      {readonly}
      {required}
      {invalid}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
      autoResize={true}
    />
  {/await}
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    &.minimal {
      :global([role='textbox']),
      :global(textarea) {
        overflow: auto;
        max-height: 240px;
      }
    }
  }
</style>
