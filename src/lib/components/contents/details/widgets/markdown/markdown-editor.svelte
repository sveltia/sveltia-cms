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
  import { getContext, untrack } from 'svelte';

  import { entryDraft } from '$lib/services/contents/draft';
  import { getCanonicalLocale } from '$lib/services/contents/i18n';
  import {
    BUILTIN_COMPONENTS,
    BUTTON_NAME_MAP,
    COMPONENT_NAME_PREFIX_REGEX,
    DEFAULT_BUTTONS,
    DEFAULT_MODES,
    NODE_NAME_MAP,
  } from '$lib/services/contents/widgets/markdown';
  import { EditorComponent } from '$lib/services/contents/widgets/markdown/components';
  import {
    customComponentRegistry,
    getComponentDef,
  } from '$lib/services/contents/widgets/markdown/components/definitions';
  import {
    RASTER_IMAGE_EXTENSION_REGEX,
    SUPPORTED_IMAGE_TYPES,
    VECTOR_IMAGE_EXTENSION_REGEX,
  } from '$lib/services/utils/media/image';

  /**
   * @import { FieldEditorContext, WidgetEditorProps } from '$lib/types/private';
   * @import { MarkdownField } from '$lib/types/public';
   */

  /**
   * @typedef {{ file?: File, src?: string, alt?: string }} ImageEntry
   */

  /**
   * @typedef {object} Props
   * @property {MarkdownField} fieldConfig Field configuration.
   * @property {string | undefined} currentValue Field value.
   */

  /** @type {FieldEditorContext} */
  const { widgetContext = undefined } = getContext('field-editor') ?? {};
  const inEditorComponent = widgetContext === 'markdown-editor-component';

  /** @type {WidgetEditorProps & Props} */
  let {
    /* eslint-disable prefer-const */
    locale,
    keyPath,
    fieldId,
    fieldConfig,
    currentValue = $bindable(),
    required = true,
    readonly = false,
    invalid = false,
    /* eslint-enable prefer-const */
  } = $props();

  /** @type {HTMLElement | undefined} */
  let wrapper = $state();
  let inputValue = $state('');

  let cleanupTimeout = 0;

  const {
    // Widget-specific options
    modes: _modes = [...DEFAULT_MODES],
    buttons: _buttons = [...DEFAULT_BUTTONS],
    editor_components:
      // Include all built-in and custom components by default
      _editorComponents = [...BUILTIN_COMPONENTS, ...customComponentRegistry.keys()],
    linked_images: linkedImagesEnabled = true,
    minimal = false,
  } = $derived(fieldConfig);
  const modes = $derived(_modes.map((name) => NODE_NAME_MAP[name]).filter(Boolean));
  const buttons = $derived(
    [
      ..._buttons,
      // Include `code-block` implemented as a block type
      ...(_editorComponents.includes('code-block') ? ['code-block'] : []),
    ]
      // @ts-ignore
      .map((name) => BUTTON_NAME_MAP[name])
      .filter(Boolean),
  );
  const components = $derived.by(() => {
    // Disable nested components
    if (inEditorComponent) {
      return [];
    }

    return _editorComponents
      .map((name) =>
        getComponentDef(name === 'image' && linkedImagesEnabled ? 'linked-image' : name),
      )
      .filter((def) => !!def)
      .map(
        (def) =>
          /** @type {import('@sveltia/ui').TextEditorComponent} */ (new EditorComponent(def)),
      );
  });
  const imageComponent = $derived(
    components.find(({ id }) => id === 'image' || id === 'linked-image'),
  );

  /**
   * Insert images to the editor content.
   * @param {object} args Arguments.
   * @param {EventTarget | null} args.target Event target.
   * @param {ImageEntry[]} args.images Image list.
   */
  const insertImages = ({ target, images }) => {
    const outer = /** @type {HTMLElement} */ (target)?.closest('div');
    const editor = getNearestEditorFromDOMNode(outer);

    if (!imageComponent || !outer?.matches('.lexical-root') || !editor) {
      return;
    }

    images.forEach(({ file, src, alt = '' }) => {
      if (file) {
        src = URL.createObjectURL(file);
      }

      editor.update(
        () => {
          insertNodes([imageComponent.createNode({ src, alt }), createParagraphNode()]);
        },
        {
          // eslint-disable-next-line jsdoc/require-jsdoc
          onUpdate: async () => {
            if (!file) {
              return;
            }

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
   * Handle pasted file. If it’s an image, insert it to the editor content.
   * @param {ClipboardEvent} event `paste` event.
   */
  const onPaste = async (event) => {
    const { target, clipboardData } = event;
    const pastedItems = clipboardData?.items;

    if (!pastedItems) {
      return;
    }

    /** @type {ImageEntry[]} */
    let images = [];

    const fileIndex = [...pastedItems].findIndex(
      ({ kind, type }) => kind === 'file' && SUPPORTED_IMAGE_TYPES.includes(type),
    );

    const htmlIndex = [...pastedItems].findIndex(
      ({ kind, type }) => kind === 'string' && type === 'text/html',
    );

    if (fileIndex > -1 && htmlIndex > -1) {
      // Handle pasted remote files: When a remote image is copied within the browser, both file and
      // HTML with `<img>` are added to the clipboard. Scrape the filename and alt text from the
      // HTML content
      const file = fileIndex > -1 ? pastedItems[fileIndex].getAsFile() : undefined;

      if (!file) {
        return;
      }

      // Clear the clipboard to prevent Lexical from pasting the HTML
      pastedItems.clear();
      event.stopPropagation();

      let alt = '';
      let fileName = file.name;

      /** @type {?HTMLImageElement} */
      const img = await new Promise((resolve) => {
        pastedItems[htmlIndex].getAsString((str) => {
          resolve(new DOMParser().parseFromString(str, 'text/html').querySelector('img'));
        });
      });

      if (img) {
        alt = img.alt;

        if (/^https?:/.test(img.src)) {
          const name = new URL(img.src).pathname.split('/').pop() ?? '';

          if (RASTER_IMAGE_EXTENSION_REGEX.test(name) || VECTOR_IMAGE_EXTENSION_REGEX.test(name)) {
            fileName = name;
          }
        }
      }

      images = [{ file: new File([file], fileName, { type: file.type }), alt }];
    } else {
      // Handle pasted local files
      images = [...clipboardData.files]
        .filter(({ type }) => SUPPORTED_IMAGE_TYPES.includes(type))
        .map((file) => ({ file }));
    }

    if (images.length) {
      images = images.map(({ file, alt }, index) => {
        // Rename pasted file with generic name
        if (file?.name === 'image.png') {
          const { year, month, day, hour, minute, second } = getDateTimeParts();
          const suffix = images.length > 1 ? `-${index + 1}` : '';
          const fileName = `${year}${month}${day}-${hour}${minute}${second}${suffix}.png`;

          file = new File([file], fileName, { type: file.type });
        }

        return { file, alt };
      });

      insertImages({ target, images });
    }
  };

  /**
   * Handle dropped file(s). If it’s an image, insert it to the editor content.
   * @param {DragEvent} event `drop` event.
   */
  const onDrop = async (event) => {
    const { target, dataTransfer } = event;
    const droppedFiles = dataTransfer?.files;
    /** @type {ImageEntry[]} */
    let images = [];

    if (droppedFiles?.length) {
      // Handle dropped local files
      images = [...droppedFiles]
        .filter(({ type }) => SUPPORTED_IMAGE_TYPES.includes(type))
        .map((file) => ({ file }));
    } else {
      // Handle dropped remote files: The clipboard doesn’t contain the file itself but the HTML may
      // contain `<img>`; use the `src` and `alt` attributes to insert a new image. We don’t fetch
      // the file unless a data URL is given, because it’s likely to fail due to the external site’s
      // CORS policy
      const html = event.dataTransfer?.getData('text/html');

      if (html) {
        const img = new DOMParser().parseFromString(html, 'text/html').querySelector('img');

        if (img) {
          const { src, alt } = img;
          const dataMatcher = src.match(/^data:(?<type>image\/.+?);base64,.+/);
          /** @type {File | undefined} */
          let file = undefined;

          if (dataMatcher) {
            const type = dataMatcher.groups?.type ?? '';

            if (SUPPORTED_IMAGE_TYPES.includes(type)) {
              try {
                const blob = await (await fetch(src)).blob();
                const { year, month, day, hour, minute, second } = getDateTimeParts();
                const extension = type.split('/')[1];
                const fileName = `${year}${month}${day}-${hour}${minute}${second}.${extension}`;

                file = new File([blob], fileName, { type });
              } catch {
                return;
              }
            }
          }

          images = [{ file, src, alt }];
        }
      }
    }

    if (images.length) {
      insertImages({ target, images });
    }
  };

  /**
   * Update {@link inputValue} based on {@link currentValue} while avoiding a cycle dependency.
   */
  const setInputValue = () => {
    const newValue = typeof currentValue === 'string' ? currentValue : '';

    if (inputValue !== newValue) {
      inputValue = newValue;
    }

    // Skip cleanup when used as a nested component editor
    if (!$entryDraft || inEditorComponent) {
      return;
    }

    window.clearTimeout(cleanupTimeout);

    // Remove values that are not present in the editor anymore. Otherwise, they will trigger
    // validation errors when the entry is saved.
    cleanupTimeout = window.setTimeout(() => {
      Object.keys($entryDraft?.extraValues[locale] ?? {}).forEach((key) => {
        const [prefix] = key.match(COMPONENT_NAME_PREFIX_REGEX) ?? [];

        if (
          prefix?.startsWith(`${keyPath}:`) &&
          !wrapper?.querySelector(`[data-key-path-prefix="${prefix}"]`)
        ) {
          delete $entryDraft.extraValues[locale][key];
        }
      });
    }, 500);
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

<div role="none" class="wrapper" class:minimal bind:this={wrapper}>
  {#await sleep() then}
    <!--
      Reset the editor when the configuration changes. It happens when fields are reordered or
      removed in a variable type list field. @see https://github.com/sveltia/sveltia-cms/issues/480
    -->
    {#key JSON.stringify(fieldConfig)}
      <TextEditor
        lang={getCanonicalLocale(locale)}
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
        onpastecapture={(/** @type {ClipboardEvent} */ event) => {
          // Use `capture` to handle the event before Lexical does
          onPaste(event);
        }}
        ondrop={(/** @type {DragEvent} */ event) => {
          onDrop(event);
        }}
      />
    {/key}
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
          // Remove the section padding
          margin: 0 calc(var(--field-editor-padding) * -1) calc(var(--field-editor-padding) * -1);
          width: 100dvw;
        }

        :is(:global(.sui.toolbar, .lexical-root, textarea)) {
          border: 0;
          border-radius: 0;
        }
      }
    }
  }
</style>
