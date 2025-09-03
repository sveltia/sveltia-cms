interface Window {
  CMS: Proxy;
  CMS_MANUAL_INIT?: boolean;
  initCMS: Function;
  showDirectoryPicker: Function;
  // React
  createClass: Function;
  createElement: Function;
  h: Function;
}

interface Navigator {
  userAgentData?: { platform: string; brands: { brand: string }[] };
}

interface Document {
  startViewTransition?: Function;
}

interface Element {
  scrollIntoViewIfNeeded?: Function;
}

interface FileSystemFileHandle {
  move: Function;
  createWritable?: Function;
}

interface FileSystemDirectoryHandle {
  keys: Function;
  entries: Function;
  requestPermission: Function;
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
