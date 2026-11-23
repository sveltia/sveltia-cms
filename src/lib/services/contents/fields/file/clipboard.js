/**
 * Read an image from the clipboard, for a field to take it in place of a file picked in the Select
 * Assets dialog. The file is named after the time it’s pasted, with the extension of its type.
 * @returns {Promise<File | undefined>} Image file, or `undefined` if the clipboard holds no image.
 * @throws {Error} When the clipboard can’t be read, e.g. the user has denied access to it.
 */
export const readClipboardImage = async () => {
  const clipboardItems = await navigator.clipboard.read();
  /**
   * Get the image type of a clipboard item.
   * @param {ClipboardItem} item Clipboard item.
   * @returns {string | undefined} First image type of the item, if any.
   */
  const getImageType = (item) => item.types.find((type) => type.startsWith('image/'));
  const item = clipboardItems.find(getImageType);
  const type = item ? getImageType(item) : undefined;

  if (!item || !type) {
    return undefined;
  }

  const blob = await item.getType(type);
  const ext = type.split('/')[1].replace('+xml', '');

  return new File([blob], `pasted-image-${Date.now()}.${ext}`, { type });
};
