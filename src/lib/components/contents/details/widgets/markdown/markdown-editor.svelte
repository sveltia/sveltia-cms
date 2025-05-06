<!--
  @component
  Implement the editor for the Markdown widget.
  @see https://decapcms.org/docs/widgets/#markdown
-->
<script>
  import { TextEditor } from '@sveltia/ui';
  import { getDateTimeParts } from '@sveltia/utils/datetime';
  import { sleep } from '@sveltia/utils/misc';
  import {
    $createParagraphNode as createParagraphNode,
    getNearestEditorFromDOMNode,
    $insertNodes as insertNodes,
  } from 'lexical';
  import { untrack } from 'svelte';
  import { rasterImageFormats } from '$lib/services/utils/media/image';
  import {
    EditorComponent,
    getComponentDef,
  } from '$lib/services/contents/widgets/markdown/component';
  import {
    buttonNameMap,
    customComponents,
    defaultButtons,
    defaultComponents,
    defaultModes,
    modeNameMap,
  } from '$lib/services/contents/widgets/markdown';

  /**
   * @import { WidgetEditorProps } from '$lib/types/private';
   * @import { MarkdownField } from '$lib/types/public';
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
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

  const {
    // Widget-specific options
    modes: _modes = [...defaultModes],
    buttons: _buttons = [...defaultButtons],
    editor_components: _editorComponents = [...defaultComponents],
    minimal = false,
  } = $derived(fieldConfig);
  const modes = $derived(_modes.map((name) => modeNameMap[name]).filter(Boolean));
  const buttons = $derived(
    [
      ..._buttons,
      // Include `code-block` implemented as a block type
      ...(_editorComponents.includes('code-block') ? ['code-block'] : []),
    ]
      // @ts-ignore
      .map((name) => buttonNameMap[name])
      .filter(Boolean),
  );
  const components = $derived(
    /** @type {import('@sveltia/ui').TextEditorComponent[]} */ (
      [
        ..._editorComponents
          .map((name) =>
            // Exclude `code-block` implemented as a block type, as well as custom components
            name === 'code-block' || name in customComponents ? undefined : getComponentDef(name),
          )
          .filter((definition) => !!definition),
        ...Object.values(customComponents),
      ].map((definition) => new EditorComponent(definition))
    ),
  );
  const imageComponent = $derived(components.find(({ id }) => id === 'image'));

  const supportedImageTypes = [...rasterImageFormats, 'svg+xml'];

  /**
   * Handle pasted or dropped file(s). If it’s an image, insert it to the editor content.
   * @param {ClipboardEvent | DragEvent} event `paste` or `drop` event.
   */
  const onFileInsert = async (event) => {
    const outer = /** @type {HTMLElement} */ (event.target)?.closest('div');
    const editor = getNearestEditorFromDOMNode(outer);

    if (!imageComponent || !outer?.matches('.lexical-root') || !editor) {
      return;
    }

    const files = [
      ...((event.type === 'paste'
        ? /** @type {ClipboardEvent} */ (event).clipboardData?.files
        : /** @type {DragEvent} */ (event).dataTransfer?.files) ?? []),
    ];

    files.forEach((file) => {
      const { name, type } = file;

      if (!type.startsWith('image/') || !supportedImageTypes.includes(type.split('/')[1])) {
        return;
      }

      // Rename pasted file with generic name
      if (name === 'image.png') {
        const { year, month, day, hour, minute, second } = getDateTimeParts();
        const fileName = `${year}-${month}-${day}-${hour}-${minute}-${second}.png`;

        file = new File([file], fileName, { type });
      }

      const src = URL.createObjectURL(file);

      editor.update(
        () => {
          insertNodes([imageComponent.createNode({ src }), createParagraphNode()]);
        },
        {
          // eslint-disable-next-line jsdoc/require-jsdoc
          onUpdate: async () => {
            await sleep(250);

            const dropTarget = outer.querySelector(`img[src="${src}"]`)?.closest('.drop-target');

            // Dispatch `Select` event so the file is processed in `FileEditor`
            dropTarget?.dispatchEvent(new CustomEvent('Select', { detail: { files: [file] } }));
          },
        },
      );
    });
  };

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
    void [currentValue];

    untrack(() => {
      setInputValue();
    });
  });

  $effect(() => {
    void [inputValue];

    untrack(() => {
      setCurrentValue();
    });
  });
</script>

<div role="none" class="wrapper" class:minimal>
  {#await sleep() then}
    <TextEditor
      lang={locale}
      {modes}
      {buttons}
      {components}
      bind:value={inputValue}
      flex
      {readonly}
      {required}
      {invalid}
      aria-labelledby="{fieldId}-label"
      aria-errormessage="{fieldId}-error"
      autoResize={true}
      onpaste={(/** @type {ClipboardEvent} */ event) => {
        onFileInsert(event);
      }}
      ondrop={(/** @type {DragEvent} */ event) => {
        onFileInsert(event);
      }}
    />
  {/await}
</div>

<style lang="scss">
  .wrapper {
    display: contents;

    &.minimal {
      :global {
        :is([role='textbox'], textarea) {
          overflow: auto;
          max-height: 240px;
        }
      }
    }

    :global {
      @media (width < 768px) {
        .sui.text-editor {
          // Remove the section margin
          margin: 0 -16px -16px;
          width: 100dvw;
        }

        :is(.sui.toolbar, .lexical-root, textarea) {
          border: 0;
          border-radius: 0;
        }
      }
    }
  }
</style>
