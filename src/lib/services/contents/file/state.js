/**
 * @import { FileState } from '$lib/types/private';
 */

/**
 * What is remembered about each file when it’s read, keyed by file path, so the file is saved back
 * the way it was written: the front matter format detected in it, the source text of the values the
 * parsed content can’t tell apart from others, and the comments at the top of it. See
 * {@link FileState}.
 * @type {Map<string, FileState>}
 */
export const fileStates = new Map();

/**
 * Set what is remembered about the given file, replacing what was. A property set to `undefined` is
 * left out, and the file is forgotten once nothing is remembered about it.
 * @param {string} path File path.
 * @param {FileState} state What is remembered.
 */
export const setFileState = (path, state) => {
  const props = Object.entries(state).filter(([, value]) => value !== undefined);

  if (props.length) {
    fileStates.set(path, Object.fromEntries(props));
  } else {
    fileStates.delete(path);
  }
};

/**
 * Update what is remembered about the given file. A property set to `undefined` is forgotten, and
 * so is the file once nothing is remembered about it.
 * @param {string} path File path.
 * @param {FileState} props Properties to update.
 */
export const updateFileState = (path, props) => {
  setFileState(path, { ...fileStates.get(path), ...props });
};

/**
 * Get what is remembered about a file before a save, and let the file after the save, which may
 * have been renamed, take it over, so it’s saved the same way next time as well. A new file doesn’t
 * take over what was remembered about a file deleted from the same path.
 * @param {object} args Arguments.
 * @param {string} [args.previousPath] Path of the file before the save, if it exists.
 * @param {string} args.path Path of the file after the save.
 * @returns {FileState} What is remembered. Empty if nothing is.
 */
export const takeOverFileState = ({ previousPath, path }) => {
  const state = previousPath ? fileStates.get(previousPath) : undefined;

  if (state) {
    fileStates.set(path, state);
  } else {
    fileStates.delete(path);
  }

  return state ?? {};
};
