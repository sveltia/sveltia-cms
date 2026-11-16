// @vitest-environment happy-dom

import { beforeEach, describe, expect, it, vi } from 'vitest';

import { canMoveRequestTo } from '$lib/services/assets/movable';
import { assetMoveRequest, draggedFiles } from '$lib/services/assets/state';

import {
  ASSET_DRAG_TYPE,
  createAssetDragSource,
  createAssetDropTarget,
  isAssetDrag,
} from './drag.js';

vi.mock('$lib/services/assets/movable', () => ({
  canMoveRequestTo: vi.fn(() => true),
}));

vi.mock('$lib/services/assets/state', () => ({
  assetMoveRequest: { current: undefined },
  draggedFiles: { current: undefined },
}));

const asset = /** @type {any} */ ({ path: 'static/uploads/a.png', name: 'a.png' });
const folder = /** @type {any} */ ({ internalPath: 'static/projects' });

/**
 * Create a drag event with a data transfer, which happy-dom doesn’t give one.
 * @param {string} type Event type.
 * @param {object} [options] Options.
 * @param {string[]} [options.types] Types of the drag data.
 * @param {EventTarget | null} [options.relatedTarget] Related target.
 * @returns {DragEvent} Event.
 */
const createDragEvent = (type, { types = [], relatedTarget = null } = {}) => {
  /** @type {Record<string, string>} */
  const data = {};
  const event = new Event(type, { bubbles: true, cancelable: true });

  Object.defineProperties(event, {
    dataTransfer: {
      value: {
        types,
        dropEffect: 'none',
        effectAllowed: 'none',
        data,
        // eslint-disable-next-line jsdoc/require-jsdoc
        setData: (/** @type {string} */ format, /** @type {string} */ value) => {
          data[format] = value;
        },
      },
    },
    relatedTarget: { value: relatedTarget },
  });

  return /** @type {DragEvent} */ (event);
};

describe('assets/drag', () => {
  beforeEach(() => {
    draggedFiles.current = undefined;
    assetMoveRequest.current = undefined;
    vi.mocked(canMoveRequestTo).mockReturnValue(true);
  });

  describe('isAssetDrag', () => {
    it('tells a drag of assets from other drags', () => {
      expect(isAssetDrag(createDragEvent('dragover', { types: [ASSET_DRAG_TYPE] }))).toBe(true);
      expect(isAssetDrag(createDragEvent('dragover', { types: ['Files'] }))).toBe(false);
      expect(isAssetDrag(/** @type {DragEvent} */ (new Event('dragover')))).toBe(false);
    });
  });

  describe('createAssetDragSource', () => {
    it('makes the element draggable, and drags the assets', () => {
      const element = document.createElement('div');

      const detach = /** @type {() => void} */ (
        createAssetDragSource(() => ({ assets: [asset] }))(element)
      );

      expect(element.draggable).toBe(true);

      const event = createDragEvent('dragstart');

      element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
      expect(draggedFiles.current).toEqual({ assets: [asset] });
      expect(event.dataTransfer?.effectAllowed).toBe('move');
      expect(/** @type {any} */ (event.dataTransfer).data).toEqual({
        [ASSET_DRAG_TYPE]: '["static/uploads/a.png"]',
      });

      element.dispatchEvent(createDragEvent('dragend'));
      expect(draggedFiles.current).toBeUndefined();

      detach();
      expect(element.draggable).toBe(false);
      element.dispatchEvent(createDragEvent('dragstart'));
      expect(draggedFiles.current).toBeUndefined();
    });

    it('drags files on a cloud storage service by their IDs', () => {
      const element = document.createElement('div');
      const service = /** @type {any} */ ({ serviceId: 'aws_s3' });
      const file = /** @type {any} */ ({ id: 'uploads/b.png' });

      createAssetDragSource(() => ({ externalAssets: [file], service }))(element);

      const event = createDragEvent('dragstart');

      element.dispatchEvent(event);
      expect(draggedFiles.current).toEqual({ externalAssets: [file], service });
      expect(/** @type {any} */ (event.dataTransfer).data).toEqual({
        [ASSET_DRAG_TYPE]: '["uploads/b.png"]',
      });
    });

    it('cancels the drag when there’s nothing to drag', () => {
      const element = document.createElement('div');

      createAssetDragSource(() => undefined)(element);

      const event = createDragEvent('dragstart');

      element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(draggedFiles.current).toBeUndefined();
    });

    it('cancels the drag without drag data', () => {
      const element = document.createElement('div');

      createAssetDragSource(() => ({ assets: [asset] }))(element);

      const event = new Event('dragstart', { cancelable: true });

      element.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(true);
      expect(draggedFiles.current).toBeUndefined();
    });
  });

  describe('createAssetDropTarget', () => {
    /**
     * Create a drop target element.
     * @returns {{ element: HTMLElement, child: HTMLElement, detach: () => void }} Elements.
     */
    const setUp = () => {
      const element = document.createElement('div');
      const child = document.createElement('span');

      element.append(child);
      document.body.append(element);

      const detach = /** @type {() => void} */ (
        createAssetDropTarget({ folder, dirPath: 'static/projects/2024' })(element)
      );

      return { element, child, detach };
    };

    it('takes dragged assets, highlighting itself, and opens the Move dialog on a drop', () => {
      const { element, detach } = setUp();
      const outer = vi.fn();

      document.body.addEventListener('dragover', outer);
      draggedFiles.current = { assets: [asset] };

      const over = createDragEvent('dragover', { types: [ASSET_DRAG_TYPE] });

      element.dispatchEvent(over);
      expect(over.defaultPrevented).toBe(true);
      expect(over.dataTransfer?.dropEffect).toBe('move');
      expect(element.classList.contains('dragover')).toBe(true);
      expect(outer).not.toHaveBeenCalled();
      expect(canMoveRequestTo).toHaveBeenCalledWith({
        request: { assets: [asset] },
        folder,
        service: undefined,
        dirPath: 'static/projects/2024',
      });

      const drop = createDragEvent('drop', { types: [ASSET_DRAG_TYPE] });

      element.dispatchEvent(drop);
      expect(drop.defaultPrevented).toBe(true);
      expect(element.classList.contains('dragover')).toBe(false);
      expect(assetMoveRequest.current).toEqual({
        assets: [asset],
        dirPath: 'static/projects/2024',
        serviceId: undefined,
      });
      expect(draggedFiles.current).toBeUndefined();

      document.body.removeEventListener('dragover', outer);
      detach();
    });

    it('opens the Move dialog with a cloud storage service dropped on', () => {
      const element = document.createElement('div');
      const service = /** @type {any} */ ({ serviceId: 'aws_s3' });

      createAssetDropTarget({ service, dirPath: '' })(element);
      draggedFiles.current = { assets: [asset] };
      element.dispatchEvent(createDragEvent('drop', { types: [ASSET_DRAG_TYPE] }));

      expect(canMoveRequestTo).toHaveBeenCalledWith({
        request: { assets: [asset] },
        folder: undefined,
        service,
        dirPath: '',
      });
      expect(assetMoveRequest.current).toEqual({
        assets: [asset],
        dirPath: '',
        serviceId: 'aws_s3',
      });
    });

    it('refuses assets that can’t be moved there', () => {
      const { element } = setUp();

      vi.mocked(canMoveRequestTo).mockReturnValue(false);
      draggedFiles.current = { assets: [asset] };

      const over = createDragEvent('dragover', { types: [ASSET_DRAG_TYPE] });

      element.dispatchEvent(over);
      expect(over.defaultPrevented).toBe(true);
      expect(over.dataTransfer?.dropEffect).toBe('none');
      expect(element.classList.contains('dragover')).toBe(false);

      element.dispatchEvent(createDragEvent('drop', { types: [ASSET_DRAG_TYPE] }));
      expect(assetMoveRequest.current).toBeUndefined();
      expect(draggedFiles.current).toBeUndefined();
    });

    it('leaves other drags, like files from the computer, alone', () => {
      const { element } = setUp();
      const over = createDragEvent('dragover', { types: ['Files'] });
      const drop = createDragEvent('drop', { types: ['Files'] });

      element.dispatchEvent(over);
      element.dispatchEvent(drop);
      expect(over.defaultPrevented).toBe(false);
      expect(drop.defaultPrevented).toBe(false);
      expect(element.classList.contains('dragover')).toBe(false);
      expect(assetMoveRequest.current).toBeUndefined();
    });

    it('keeps the highlight while the pointer moves onto a descendant', () => {
      const { element, child, detach } = setUp();

      element.classList.add('dragover');
      element.dispatchEvent(createDragEvent('dragleave', { relatedTarget: child }));
      expect(element.classList.contains('dragover')).toBe(true);
      element.dispatchEvent(createDragEvent('dragleave', { relatedTarget: document.body }));
      expect(element.classList.contains('dragover')).toBe(false);

      element.classList.add('dragover');
      detach();
      expect(element.classList.contains('dragover')).toBe(false);
    });
  });
});
