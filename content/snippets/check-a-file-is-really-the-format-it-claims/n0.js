/**
 * Decide what an uploaded file is from its bytes, not from what it says it is.
 *
 * Rung N0. The first bytes of a file are its format: 89 50 4E 47 for a PNG,
 * %PDF- for a PDF, PK for anything built on a ZIP archive. Those signatures
 * are published tables, and reading them is a comparison — no model is
 * involved, and none could be, because the answer is exact.
 *
 * Where the answer comes from is the whole point of this rung. The file name
 * and the Content-Type header travel with the upload, which means the client
 * wrote them: they are a claim, not a fact. This function takes them as a
 * claim, reads the bytes on its own, and reports whether the two agree.
 *
 * `file-type` carries the signature table here, `puremagic` in Python. One
 * difference between them is handled in the Python file: every ZIP-based
 * format starts with PK, `file-type` opens the archive to tell a .docx from a
 * .xlsx, and `puremagic` returns half a dozen candidates at the same score.
 * Twelve lines of `zipfile` there read the archive the same way, so both
 * languages answer the same thing.
 *
 * What no table can do is a format whose file is text. A CSV, a JSON file, an
 * SVG and a plain note have no binary header, so they are reported as
 * unrecognised rather than guessed — and an unrecognised file is never
 * allowed.
 */

import { fileTypeFromBuffer } from 'file-type';

// Signatures live in the first bytes; reading more than this from an untrusted
// upload buys nothing and costs memory.
export const HEAD = 4096;

// The two tables do not need the same number of bytes: `puremagic` calls a PNG
// on its eight-byte signature, `file-type` wants the sixteen that carry the
// first chunk header too. Below the larger of the two, this snippet answers
// nothing rather than answering differently in each language.
export const MIN_BYTES = 16;

// The same format under two names in the two tables.
const ALIASES = { jfif: 'jpg', jpeg: 'jpg', tif: 'tiff', htm: 'html' };

// What a web upload actually carries. A signature table holds a thousand
// formats, and on binary noise it finds one: a hundred null bytes come back
// from `puremagic` as a Compucon-Singer embroidery design, at the same
// confidence as a real PNG. Answering only for this list turns that into a
// refusal instead of a wrong answer — and text formats are not on it, because
// they have no binary signature to read whatever a table claims.
const KNOWN = new Set([
  'png', 'jpg', 'gif', 'webp', 'avif', 'heic', 'tiff', 'bmp', 'ico',
  'pdf', 'rtf', 'zip', 'docx', 'xlsx', 'pptx', 'odt', 'ods', 'odp',
  'mp3', 'mp4', 'wav', 'ogg', 'webm', 'gz', '7z', 'rar', 'exe',
]);

/**
 * Say what the bytes are, and whether that matches what was claimed.
 *
 * `claimedName` is the file name the client sent. It is never used to decide,
 * only to be contradicted: `matches_claim` is the comparison, and a caller
 * that logs a false there is looking at either a mistake or an attack.
 *
 * `allowed` is the caller's own list of extensions. `allowed` in the report is
 * true only when something was recognised and it is on that list: an
 * unrecognised file is never allowed by default.
 *
 * @param {Uint8Array} data
 * @param {{claimedName?: string, allowed?: Iterable<string>}} [options]
 */
export async function sniffFile(data, { claimedName, allowed = [] } = {}) {
  if (!ArrayBuffer.isView(data) && !(data instanceof ArrayBuffer)) {
    return report(null, claimedName, allowed, `a file is bytes, not ${kindOf(data)}`);
  }
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : new Uint8Array(data.buffer ?? data, data.byteOffset ?? 0, data.byteLength);
  if (bytes.length === 0) return report(null, claimedName, allowed, 'the file is empty');
  if (bytes.length < MIN_BYTES) {
    return report(null, claimedName, allowed,
      `under ${MIN_BYTES} bytes: too short to carry a signature`);
  }

  const match = await fileTypeFromBuffer(bytes.subarray(0, HEAD));
  const extension = match ? ALIASES[match.ext] ?? match.ext : null;
  if (extension === null || !KNOWN.has(extension)) {
    return report(null, claimedName, allowed, 'no signature read from the bytes');
  }
  return report(extension, claimedName, allowed, null);
}

const kindOf = (value) => (value === null ? 'null' : typeof value);

function report(detected, claimedName, allowed, reason) {
  const claimed = claimedName && claimedName.includes('.')
    ? claimedName.slice(claimedName.lastIndexOf('.') + 1).toLowerCase()
    : null;
  return {
    detected,
    claimed,
    // null when there is nothing to compare: no claim, or nothing read.
    matches_claim: claimed === null || detected === null ? null : claimed === detected,
    allowed: detected !== null && [...allowed].includes(detected),
    reason,
  };
}
