import { canMoveRequestTo } from '$lib/services/assets/movable';
import { assetMoveRequest, draggedFiles } from '$lib/services/assets/state';

/**
 * @import { Attachment } from 'svelte/attachments';
 * @import { AssetFolderInfo, AssetMoveRequest, MediaLibraryService } from '$lib/types/private';
 */

/**
 * Type of the drag data set when files are dragged from the asset list: the JSON-encoded paths of
 * repository assets or IDs of files on a cloud storage service. It tells such a drag apart from a
 * drag of files from the user’s computer, which the upload drop zone takes.
 */
export const ASSET_DRAG_TYPE = 'application/x-sveltia-cms-assets';

/**
 * Class added to a drop target while assets that can be dropped on it are dragged over it.
 */
const DRAGOVER_CLASS = 'dragover';

/**
 * Whether the given drag event carries assets dragged from the asset list.
 * @param {DragEvent} event Drag event.
 * @returns {boolean} Result.
 */
export const isAssetDrag = (event) => !!event.dataTransfer?.types.includes(ASSET_DRAG_TYPE);

/**
 * Create an attachment that makes a row in the asset list draggable, so the files can be dropped
 * on a folder to be moved there.
 * @param {() => AssetMoveRequest | undefined} getRequest Function returning the files to drag: the
 * selected ones if the row is part of the selection, or the row’s own file otherwise, as a move
 * request. `undefined` if the files can’t be moved.
 * @returns {Attachment<HTMLElement>} Attachment.
 */
export const createAssetDragSource = (getRequest) => (element) => {
  /**
   * Start dragging the files.
   * @param {DragEvent} event `dragstart` event.
   */
  const onDragStart = (event) => {
    const request = getRequest();

    if (!request || !event.dataTransfer) {
      event.preventDefault();

      return;
    }

    const { assets = [], externalAssets = [] } = request;

    draggedFiles.current = request;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(
      ASSET_DRAG_TYPE,
      JSON.stringify([...assets.map(({ path }) => path), ...externalAssets.map(({ id }) => id)]),
    );
  };

  /**
   * Let go of the files once the drag is over, whether or not they have been dropped.
   */
  const onDragEnd = () => {
    draggedFiles.current = undefined;
  };

  element.draggable = true;
  element.addEventListener('dragstart', onDragStart);
  element.addEventListener('dragend', onDragEnd);

  return () => {
    element.draggable = false;
    element.removeEventListener('dragstart', onDragStart);
    element.removeEventListener('dragend', onDragEnd);
  };
};

/**
 * Create an attachment that makes a folder or a cloud storage service in the sidebar, or a
 * subfolder in the asset list, a drop target for the files dragged from the list. Dropping them
 * opens the Move dialog with the folder selected, where the move is confirmed. A drag of anything
 * else, like files from the user’s computer, is left alone.
 * @param {object} args Arguments.
 * @param {AssetFolderInfo} [args.folder] Asset folder the directory belongs to, for a repository
 * directory.
 * @param {MediaLibraryService} [args.service] Cloud storage service, for a folder on it.
 * @param {string} args.dirPath Directory path.
 * @returns {Attachment<HTMLElement>} Attachment.
 */
export const createAssetDropTarget =
  ({ folder, service, dirPath }) =>
  (element) => {
    /**
     * Whether the dragged assets can be moved to the directory.
     * @returns {boolean} Result.
     */
    const canDrop = () =>
      canMoveRequestTo({ request: draggedFiles.current, folder, service, dirPath });

    /**
     * Tell whether the assets can be dropped here, and highlight the target if they can.
     * @param {DragEvent} event `dragover` event.
     */
    const onDragOver = (event) => {
      if (!isAssetDrag(event)) {
        return;
      }

      // Keep a target inside the asset list from passing the drag on to the upload drop zone
      event.preventDefault();
      event.stopPropagation();

      const droppable = canDrop();

      /** @type {DataTransfer} */ (event.dataTransfer).dropEffect = droppable ? 'move' : 'none';
      element.classList.toggle(DRAGOVER_CLASS, droppable);
    };

    /**
     * Remove the highlight once the pointer leaves the target, not one of its descendants.
     * @param {DragEvent} event `dragleave` event.
     */
    const onDragLeave = (event) => {
      if (!element.contains(/** @type {Node | null} */ (event.relatedTarget))) {
        element.classList.remove(DRAGOVER_CLASS);
      }
    };

    /**
     * Open the Move dialog for the dropped assets, with the directory selected.
     * @param {DragEvent} event `drop` event.
     */
    const onDrop = (event) => {
      if (!isAssetDrag(event)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      element.classList.remove(DRAGOVER_CLASS);

      if (canDrop()) {
        assetMoveRequest.current = {
          .../** @type {AssetMoveRequest} */ (draggedFiles.current),
          dirPath,
          serviceId: service?.serviceId,
        };
      }

      draggedFiles.current = undefined;
    };

    element.addEventListener('dragover', onDragOver);
    element.addEventListener('dragleave', onDragLeave);
    element.addEventListener('drop', onDrop);

    return () => {
      element.classList.remove(DRAGOVER_CLASS);
      element.removeEventListener('dragover', onDragOver);
      element.removeEventListener('dragleave', onDragLeave);
      element.removeEventListener('drop', onDrop);
    };
  };
