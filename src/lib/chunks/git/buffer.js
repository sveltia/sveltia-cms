import { Buffer } from 'buffer';

/**
 * Provide the global `Buffer` that isomorphic-git expects, as browsers don’t have one. It’s a
 * module of its own, imported before isomorphic-git, because the imports of a module are evaluated
 * in order. A page that already has one, e.g. from another library, keeps it.
 */
globalThis.Buffer ??= Buffer;
