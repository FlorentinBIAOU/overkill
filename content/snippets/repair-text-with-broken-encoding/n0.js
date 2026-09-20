/**
 * Repair text that was decoded with the wrong character set.
 *
 * Rung N0. « CrÃ©dit Agricole » is not damaged text: it is « Crédit Agricole »
 * whose UTF-8 bytes were read as if they were Windows-1252. The operation is
 * exactly invertible — write the characters back out as Windows-1252 bytes,
 * read those bytes as UTF-8 — and that is a byte identity, not a judgement.
 *
 * `ftfy` does it in Python and has done for a decade. It also knows the
 * variants: two rounds of the same accident, a Windows-1252 that should have
 * been Cyrillic, a UTF-8 read as UTF-16. There is no port of it in JavaScript,
 * so this file writes the main transformation itself, in about thirty lines.
 *
 * The two agree on thirty-nine of this entry's forty-seven strings, and they
 * part in both directions.
 *
 * This file repairs four short strings that `ftfy` declines: « ÃŽle-de-France »,
 * « ÃŽles Canaries », « ÃŽlot » and « Å’uvre ». `ftfy` weighs the whole string
 * and refuses when what would come out is a short run opening on an accented
 * capital — it repairs the same word inside « RÃ©gion ÃŽle-de-France ». Working
 * run by run, this file has no such heuristic. It also leaves a text that
 * already carries a replacement character alone, where `ftfy` reads that
 * character as a byte and drops the one in front of it.
 *
 * In the other direction, `ftfy` carries one rule this file does not — « Ã »
 * followed by an ordinary space is read as the « à » whose non-breaking space
 * was lost in transit, which repairs one more real case and rewrites one more
 * correct sentence — and it unwinds any depth of stacked accidents, where this
 * file stops after ROUNDS.
 *
 * Two things this file does on purpose. It repairs only the encoding, and
 * leaves quotation marks alone: `ftfy`'s wider `fix_text` straightens them,
 * which turns « L'été à Nice », already correct, into a version with a
 * straight apostrophe — a silent rewrite of French typography. And it returns
 * `changed` rather than repairing in place, because a repair that nobody
 * recorded is indistinguishable from data that was always like that.
 */

// Windows-1252, positions 0x80 to 0x9F, where it differs from Latin-1. The
// five code points that are unassigned there keep their Latin-1 value, which
// is what `ftfy` calls a sloppy Windows-1252 and what real files contain.
const WINDOWS_1252 =
  '€\u0081‚ƒ„…†‡ˆ‰Š‹Œ\u008d'
  + 'Ž\u008f\u0090‘’“”•–—˜™š›'
  + 'œ\u009džŸ';

// The character a decoder writes when it gave up: the byte is gone, and no
// round trip brings it back.
export const REPLACEMENT = '�';

// How many times the same accident may have been applied. Two is common — a
// file repaired once and re-imported — and four is already generous.
export const ROUNDS = 4;

const strict = new TextDecoder('utf-8', { fatal: true });

/** How many bytes a UTF-8 sequence starting with this byte should have. */
const sequenceLength = (byte) => (byte >= 0xf0 ? 4 : byte >= 0xe0 ? 3 : byte >= 0xc2 ? 2 : 0);

/** The byte this character would have been in Windows-1252, or null. */
function byteOf(character) {
  const special = WINDOWS_1252.indexOf(character);
  if (special >= 0) return 0x80 + special;
  const code = character.codePointAt(0);
  return code <= 0xff ? code : null;
}

/**
 * Undo a wrong decoding, and say whether anything was undone.
 *
 * `changed` is the flag a caller logs: the repair is a rewrite of somebody's
 * data, and it is wrong often enough — see this entry's breaking point — that
 * it must not happen in silence.
 *
 * `lossy` says the text that comes back carries replacement characters. Those
 * are bytes a decoder threw away before this function ever saw the string, and
 * nothing here restores them: a `lossy` text is one to import again, not one to
 * repair.
 *
 * @param {string} text
 */
export function repairEncoding(text) {
  if (typeof text !== 'string') {
    return report(null, false, false, `text is expected, not ${kindOf(text)}`);
  }
  let repaired = text;
  for (let round = 0; round < ROUNDS; round += 1) {
    const next = onePass(repaired);
    if (next === repaired) break;
    repaired = next;
  }
  return report(repaired, repaired !== text, repaired.includes(REPLACEMENT), null);
}

/**
 * One round: every run of characters whose Windows-1252 bytes form a valid
 * multi-byte UTF-8 sequence is decoded; everything else is left exactly as it
 * is. Working run by run rather than on the whole string is what lets a text
 * where only some fields are broken come back with the rest untouched.
 */
function onePass(text) {
  const characters = [...text];
  const bytes = characters.map(byteOf);
  const pieces = [];
  let i = 0;
  while (i < characters.length) {
    const length = bytes[i] === null ? 0 : sequenceLength(bytes[i]);
    const candidate = length > 0 && i + length <= characters.length
      && bytes.slice(i + 1, i + length).every((b) => b !== null && b >= 0x80 && b <= 0xbf);
    if (candidate) {
      try {
        pieces.push(strict.decode(Uint8Array.from(bytes.slice(i, i + length))));
        i += length;
        continue;
      } catch {
        // Overlong, surrogate or out of range: not a sequence, keep the character.
      }
    }
    pieces.push(characters[i]);
    i += 1;
  }
  return pieces.join('');
}

const kindOf = (value) => (value === null ? 'null' : typeof value);

const report = (text, changed, lossy, reason) => ({ text, changed, lossy, reason });
