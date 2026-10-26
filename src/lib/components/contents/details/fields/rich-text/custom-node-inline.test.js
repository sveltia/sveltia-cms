// @vitest-environment happy-dom
// @ts-nocheck
/* eslint-disable jsdoc/require-jsdoc */

import {
  $createParagraphNode,
  $createTextNode,
  $getRoot,
  $getSelection,
  $insertNodes,
  createEditor,
} from 'lexical';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createLexicalNodeFeatures } from '$lib/components/contents/details/fields/rich-text/custom-node-features';

const { mounted, InlinePatternComponent } = vi.hoisted(() => ({
  /** @type {{ component: any, props: Record<string, any>, setValues: any }[]} */
  mounted: [],
  InlinePatternComponent: vi.fn(),
}));

vi.mock('svelte', async (importOriginal) => ({
  ...(await importOriginal()),
  flushSync: vi.fn(),
  mount: vi.fn((component, { props }) => {
    const element = document.createElement('span');
    const setValues = vi.fn();

    mounted.push({ component, props, setValues });

    return { getElement: () => element, setValues };
  }),
  unmount: vi.fn(),
}));

vi.mock('$lib/components/contents/details/fields/rich-text/editor-component.svelte', () => ({
  default: vi.fn(),
}));

vi.mock(
  '$lib/components/contents/details/fields/rich-text/inline-pattern-component.svelte',
  () => ({ default: InlinePatternComponent }),
);

/**
 * Create a resolved wikilink component definition.
 * @param {Record<string, any>} [inlinePattern] Inline options.
 * @returns {any} Definition.
 */
const createDef = (inlinePattern = {}) => ({
  id: `x-wikilink-${Math.random().toString(36).slice(2)}`,
  label: 'Wikilink',
  fields: [],
  pattern: /\[\[(?<page>[^\]]+)\]\]/,
  toBlock: ({ page = '' }) => `[[${page}]]`,
  toPreview: ({ page = '' }) => `<a>${page}</a>`,
  inlinePattern: { trigger: '[[', ...inlinePattern },
});

describe('pattern-based inline component node', () => {
  /** @type {HTMLElement} */
  let rootElement;

  beforeEach(() => {
    mounted.length = 0;
    rootElement = document.createElement('div');
    rootElement.contentEditable = 'true';
    document.body.append(rootElement);
  });

  afterEach(() => {
    rootElement.remove();
  });

  /**
   * Create an editor with a paragraph, select part of it, then insert a new component like the
   * toolbar does.
   * @param {any} componentDef Definition.
   * @param {[number, number]} range Selected range in `Hello world`.
   * @returns {{ editor: any, features: any }} Editor and node features.
   */
  const insert = (componentDef, [start, end]) => {
    const features = createLexicalNodeFeatures(componentDef);

    const editor = createEditor({
      nodes: [features.node],
      onError: (error) => {
        throw error;
      },
    });

    editor.setRootElement(rootElement);
    editor.update(
      () => {
        const text = $createTextNode('Hello world');

        $getRoot().clear().append($createParagraphNode().append(text));
        text.select(start, end);
      },
      { discrete: true, tag: 'history-merge' },
    );
    editor.update(
      () => {
        $insertNodes([features.createNode()]);
      },
      { discrete: true },
    );

    return { editor, features };
  };

  /**
   * Get the text and component data of the paragraph.
   * @param {any} editor Editor.
   * @returns {{ text: string, props: any[], selection: string }} Content.
   */
  const read = (editor) =>
    editor.getEditorState().read(() => {
      const paragraph = $getRoot().getFirstChild();

      return {
        text: paragraph.getTextContent(),
        props: paragraph
          .getChildren()
          .filter((node) => node.getType().startsWith('x-wikilink'))
          .map((node) => node.__props),
        selection: $getSelection()?.getTextContent() ?? '',
      };
    });

  it('should mount the inline component with the preview and edit options', () => {
    const onEdit = vi.fn();

    insert(createDef({ onEdit }), [6, 6]);

    expect(mounted).toHaveLength(1);
    expect(mounted[0].component).toBe(InlinePatternComponent);
    expect(mounted[0].props).toMatchObject({ label: 'Wikilink', onEdit, values: undefined });
    expect(typeof mounted[0].props.toPreview).toBe('function');
    expect(typeof mounted[0].props.toBlock).toBe('function');
  });

  it('should fill in the component with the data `onInsert` returns', async () => {
    const onInsert = vi.fn(async () => ({ page: 'World' }));
    const { editor } = insert(createDef({ onInsert }), [6, 11]);

    await vi.waitFor(() => {
      expect(read(editor).props).toEqual([{ page: 'World' }]);
    });

    expect(onInsert).toHaveBeenCalledExactlyOnceWith({ selectedText: 'world' });
    expect(mounted[0].setValues).toHaveBeenCalledWith({ page: 'World' });
  });

  it('should show the data of the latest node, e.g. once a change is undone', async () => {
    const { editor } = insert(createDef(), [6, 6]);

    editor.update(
      () => {
        const node = $getRoot()
          .getFirstChild()
          .getChildren()
          .find((child) => child.getType().startsWith('x-wikilink'));

        node.getWritable().__props = { page: 'Undone' };
      },
      { discrete: true },
    );

    expect(mounted[0].setValues).toHaveBeenCalledExactlyOnceWith({ page: 'Undone' });
  });

  it('should restore the selected text if `onInsert` cancels the insertion', async () => {
    const onInsert = vi.fn(async () => null);
    const { editor } = insert(createDef({ onInsert }), [6, 11]);

    await vi.waitFor(() => {
      expect(read(editor)).toEqual({ text: 'Hello world', props: [], selection: 'world' });
    });
  });

  it('should restore the selected text if `onInsert` throws', async () => {
    const error = new Error('Failed');
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const { editor } = insert(createDef({ onInsert: () => Promise.reject(error) }), [0, 5]);

    await vi.waitFor(() => {
      expect(read(editor)).toMatchObject({ text: 'Hello world', props: [] });
    });

    expect(consoleError).toHaveBeenCalledWith(error);
    consoleError.mockRestore();
  });

  it('should remove the component if the insertion is cancelled without a selection', async () => {
    const onInsert = vi.fn(async () => undefined);
    const { editor } = insert(createDef({ onInsert }), [6, 6]);

    await vi.waitFor(() => {
      expect(onInsert).toHaveBeenCalledWith({ selectedText: '' });
    });
    await vi.waitFor(() => {
      expect(read(editor)).toMatchObject({ text: 'Hello world', props: [] });
    });
  });

  it('should leave a component removed while `onInsert` is pending alone', async () => {
    /** @type {any} */
    let resolve;

    const onInsert = vi.fn(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    );

    const { editor } = insert(createDef({ onInsert }), [6, 11]);

    await vi.waitFor(() => {
      expect(onInsert).toHaveBeenCalled();
    });

    editor.update(
      () => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append($createTextNode('Other')));
      },
      { discrete: true },
    );
    resolve({ page: 'World' });
    await new Promise((r) => {
      setTimeout(r, 10);
    });

    expect(read(editor)).toMatchObject({ text: 'Other', props: [] });
    expect(mounted[0].setValues).not.toHaveBeenCalled();
  });

  it('should insert the component with empty data without `onInsert`', async () => {
    const { editor } = insert(createDef(), [6, 11]);

    await new Promise((r) => {
      setTimeout(r, 10);
    });

    // The selected text is replaced, like any other insertion
    expect(read(editor)).toMatchObject({ text: 'Hello ', props: [undefined] });
  });

  it('should not call `onInsert` for a component created with data', async () => {
    const onInsert = vi.fn();
    const features = createLexicalNodeFeatures(createDef({ onInsert }));

    const editor = createEditor({
      nodes: [features.node],
      onError: (error) => {
        throw error;
      },
    });

    editor.setRootElement(rootElement);
    editor.update(
      () => {
        $getRoot()
          .clear()
          .append($createParagraphNode().append(features.createNode({ page: 'A' })));
      },
      { discrete: true },
    );
    await new Promise((r) => {
      setTimeout(r, 10);
    });

    expect(onInsert).not.toHaveBeenCalled();
    expect(read(editor).props).toEqual([{ page: 'A' }]);
  });

  it('should remember an empty text for a component created without a selection', () => {
    const features = createLexicalNodeFeatures(createDef({ onInsert: vi.fn() }));
    const editor = createEditor({ nodes: [features.node] });
    let node;

    // E.g. the node created to get the Markdown inserted in the plain text mode
    editor.update(
      () => {
        node = features.createNode();
      },
      { discrete: true },
    );

    expect(node.__selectedText).toBe('');
  });
});
