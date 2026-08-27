/**
 * Atomic JSON file persistence with an in-process write lock.
 *
 * The JSON stores were read-whole-file → mutate → `writeFileSync`, with no
 * locking and no atomic replace. Two overlapping requests silently discarded
 * one update — which for `creditUsed` meant two concurrent trade orders could
 * each pass the credit check while only one increment survived, taking an
 * account past its limit. A crash mid-write truncated the file outright.
 *
 * `writeJsonAtomic` writes to a temp file in the same directory and renames it
 * over the target. `rename` within a filesystem is atomic, so a reader sees
 * either the whole old file or the whole new one, never a partial write.
 *
 * `mutateJson` serialises read-modify-write cycles per path so increments are
 * not lost. That guarantee holds within one Node process — the correct fix for
 * a multi-instance deployment is a database, which is why these stores should
 * not survive the move to serverless.
 */

// CommonJS on purpose: lib/data-store.js is CommonJS and lib/trade/trade-store.js
// is ESM, and both need this. Named imports from a static `module.exports`
// object work from ESM; the reverse (require of an ESM file) does not.
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/** Per-path promise chain; each mutation waits for the previous one. */
const locks = new Map();

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });

  const tmpPath = path.join(dir, `.${path.basename(filePath)}.${crypto.randomUUID()}.tmp`);

  let fd;
  try {
    fd = fs.openSync(tmpPath, 'w');
    fs.writeFileSync(fd, JSON.stringify(data, null, 2), 'utf-8');
    // Flush to disk before the rename, so a power loss can't leave the renamed
    // file pointing at unwritten blocks.
    fs.fsyncSync(fd);
  } finally {
    if (fd !== undefined) fs.closeSync(fd);
  }

  try {
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch { /* best effort */ }
    throw err;
  }
}

/**
 * Run a read-modify-write cycle under the lock for `filePath`.
 *
 * @param {string}   filePath
 * @param {Function} read     () => object
 * @param {Function} write    (object) => void
 * @param {Function} mutate   (data) => any — mutate `data` in place; its return
 *                            value is passed back to the caller
 */
async function mutateJson(filePath, read, write, mutate) {
  const previous = locks.get(filePath) || Promise.resolve();

  const run = previous.then(async () => {
    const data = read();
    const result = await mutate(data);
    write(data);
    return result;
  });

  // The queue must survive a failed mutation, so the chain is extended with a
  // settled promise rather than with `run` itself. Otherwise one rejection
  // would wedge every later write to the same file.
  const settled = run.then(
    () => {},
    () => {}
  );
  locks.set(filePath, settled);

  // Drop the lock entry once nothing else has queued behind it.
  settled.then(() => {
    if (locks.get(filePath) === settled) locks.delete(filePath);
  });

  return run;
}

module.exports = { writeJsonAtomic, mutateJson };
