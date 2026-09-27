/* eslint-disable no-console */

/**
 * Static server for the end-to-end tests. It serves the admin page in `e2e/site` and the
 * production bundle in `package/dist`, so the tests run against what’s published rather than the
 * dev build. The config file is not served: each test answers the request with its own config.
 *
 * Usage: node e2e/server.js [port].
 */

import { createReadStream } from 'fs';
import { stat } from 'fs/promises';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(fileURLToPath(new URL('.', import.meta.url)), '..');
const port = Number(process.argv[2] ?? 4180);

/**
 * Directories served under each URL path prefix.
 */
const MOUNTS = {
  '/dist/': path.join(root, 'package/dist'),
  '/': path.join(root, 'e2e/site'),
};

/**
 * Media types by file extension.
 */
const MEDIA_TYPES = {
  '.css': 'text/css',
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.json': 'application/json',
  '.map': 'application/json',
  '.mjs': 'text/javascript',
  '.wasm': 'application/wasm',
  '.yaml': 'application/yaml',
  '.yml': 'application/yaml',
};

/**
 * Resolve a URL path to a file on the disk.
 * @param {string} pathname URL path, e.g. `/admin/`.
 * @returns {Promise<string | undefined>} File path, or `undefined` if there is no such file.
 */
const resolveFile = async (pathname) => {
  const [prefix, dir] = /** @type {[string, string]} */ (
    Object.entries(MOUNTS).find(([key]) => pathname.startsWith(key))
  );

  try {
    // A malformed escape sequence throws, and is answered with a 404 like a missing file
    let filePath = path.join(dir, decodeURIComponent(pathname.slice(prefix.length)));

    // Don’t let `..` segments escape the mounted directory, e.g. into a sibling `dist-old`
    if (filePath !== dir && !filePath.startsWith(`${dir}${path.sep}`)) {
      return undefined;
    }

    if ((await stat(filePath)).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
      await stat(filePath);
    }

    return filePath;
  } catch {
    return undefined;
  }
};

createServer(async (req, res) => {
  const filePath = await resolveFile(new URL(req.url ?? '/', 'http://localhost').pathname);

  if (!filePath) {
    res.writeHead(404).end();

    return;
  }

  res.writeHead(200, {
    'Content-Type': MEDIA_TYPES[path.extname(filePath)] ?? 'application/octet-stream',
  });
  // The file can disappear after `stat()`, e.g. while `pnpm build` replaces the bundle; end the
  // response rather than let the unhandled stream error stop the server
  createReadStream(filePath)
    .on('error', () => res.destroy())
    .pipe(res);
}).listen(port, '127.0.0.1', () => {
  console.info(`Serving the end-to-end test site at http://127.0.0.1:${port}/admin/`);
});
