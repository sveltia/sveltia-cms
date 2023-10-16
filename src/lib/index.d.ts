interface Window {
  CMS: Proxy;
  showDirectoryPicker: Function;
}

interface Navigator {
  userAgentData: { platform: string };
}

interface FileSystemFileHandle {
  createWritable: Function;
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
