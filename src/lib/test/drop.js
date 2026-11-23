/**
 * Build a drop event carrying the given files, the way a browser does when files are dropped from
 * the desktop: the drag lists the `Files` type, and each item is a file that resolves to a file
 * system entry. A `DataTransfer` built in a test can’t hold such entries, so the event carries a
 * stand-in.
 * @param {File[]} files Files.
 * @returns {Event} Event.
 */
export const createFileDropEvent = (files) => {
  const event = new Event('drop', { bubbles: true, cancelable: true });

  Object.defineProperty(event, 'dataTransfer', {
    value: {
      dropEffect: '',
      types: ['Files'],
      items: files.map((file) => ({
        kind: 'file',
        /**
         * Get the entry.
         * @returns {any} File entry.
         */
        webkitGetAsEntry: () => ({
          name: file.name,
          isFile: true,
          /**
           * Read the file.
           * @param {(file: File) => void} callback Callback.
           * @returns {void} Nothing.
           */
          file: (callback) => callback(file),
        }),
      })),
    },
  });

  return event;
};
