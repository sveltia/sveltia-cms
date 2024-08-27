interface Window {
  CMS: Proxy;
  CMS_MANUAL_INIT?: boolean;
  initCMS: Function;
  showDirectoryPicker: Function;
}

interface Navigator {
  userAgentData: { platform: string; brands: { brand: string }[] };
}

interface Element {
  scrollIntoViewIfNeeded?: Function;
}

interface FileSystemFileHandle {
  createWritable: Function;
  move: Function;
}

interface FileSystemDirectoryHandle {
  keys: Function;
  entries: Function;
  requestPermission: Function;
}

/**
 * @see https://github.com/microsoft/TypeScript/issues/29129
 */
namespace Intl {
  const getCanonicalLocales: (string) => string[];
}

/**
 * Silence some import errors.
 * @see https://stackoverflow.com/q/70682803
 */
declare module '*.svelte' {
  const content: any;
  export default content;
}

declare module '*.svg?raw&inline' {
  const content: string;
  export default content;
}
