/* eslint-disable no-console */

/**
 * Summarize a CPU profile recorded with `BENCH_PROFILE=1`: the functions that took the most time
 * themselves, with their location in the source rather than in the minified bundle.
 *
 * Usage: node bench/summarize-profile.js <profile> [number of functions].
 */

import { readFile } from 'fs/promises';
import { SourceMap } from 'module';

const [profilePath, count = '30'] = process.argv.slice(2);

if (!profilePath) {
  console.error('Usage: node bench/summarize-profile.js <profile> [number of functions]');
  process.exit(1);
}

/** @type {import('inspector').Profiler.Profile} */
const profile = JSON.parse(await readFile(profilePath, 'utf8'));

const sourceMap = new SourceMap(
  JSON.parse(
    await readFile(new URL('../package/dist/sveltia-cms.js.map', import.meta.url), 'utf8'),
  ),
);

const nodes = new Map(profile.nodes.map((node) => [node.id, node]));
/** @type {Map<number, number>} */
const selfTimes = new Map();

/* v8 ignore next */
(profile.samples ?? []).forEach((id, index) => {
  selfTimes.set(id, (selfTimes.get(id) ?? 0) + (profile.timeDeltas?.[index] ?? 0));
});

/** @type {Map<string, number>} */
const totals = new Map();
let total = 0;

selfTimes.forEach((time, id) => {
  const { functionName, url, lineNumber, columnNumber } = /** @type {any} */ (nodes.get(id))
    .callFrame;

  let label = `${functionName || '(anonymous)'} ${url.split('/').pop() || '(native)'}`;

  if (url.endsWith('/sveltia-cms.js')) {
    const { originalSource, originalLine, name } = /** @type {any} */ (
      sourceMap.findEntry(lineNumber, columnNumber)
    );

    if (originalSource) {
      const source = originalSource.replace(/^.*?((?:src|node_modules)\/)/, '$1');

      label = `${name || functionName || '(anonymous)'} ${source}:${originalLine + 1}`;
    }
  }

  total += time;
  totals.set(label, (totals.get(label) ?? 0) + time);
});

console.log(`Sampled ${Math.round(total / 1000)} ms. Self time by function:`);

[...totals]
  .sort(([, a], [, b]) => b - a)
  .slice(0, Number(count))
  .forEach(([label, time]) => {
    console.log(`${String(Math.round(time / 1000)).padStart(7)} ms  ${label}`);
  });
