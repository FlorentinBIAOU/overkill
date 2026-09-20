/**
 * Keep the last reply of an email thread, and drop the thread under it.
 *
 * Rung N0. An email client does not send the reply alone: it sends the reply,
 * then the whole conversation under it, marked by something the client wrote
 * itself — a « > » in front of each line, a line of underscores, a header
 * block, or the sentence « Le 10 octobre 2026 à 13:55, Marie Martin a écrit : ».
 * Those markers are what this rung looks for, and the reply is what sits above
 * the first of them.
 *
 * The libraries that do this are `email-reply-parser` in JavaScript and
 * `email_reply_parser` in Python. They were written for English threads, and
 * it shows: on the French thread of this entry's test, the Python one leaves
 * « Le 10 octobre 2026 à 13:55, Marie Martin <marie@exemple.fr> a écrit : » in
 * the reply, and the JavaScript one removes the signature it keeps on the
 * English thread. Two extracts that answer differently on the same message are
 * of no use to a page that shows both, so the markers are written here, French
 * ones included.
 *
 * One thing is deliberately not done: removing the signature. « Bien à vous,
 * Jean Dupont » is part of what Jean wrote, and a line holding nothing but a
 * name is sometimes the whole message. The cut happens at the quote, and stops
 * there.
 */

// What a mail client writes when it quotes, and what is under each marker.
// « quoted » means the old message is prefixed line by line, so what is not
// prefixed under it was written by the sender; « block » means it is copied
// as is, and nothing tells it apart from a reply.
export const MARKERS = [
  // A quoted line, the oldest convention of all.
  ['quoted', /^\s*>/],
  // Outlook's separator, and the header block that follows it.
  ['block', /^\s*_{5,}\s*$/],
  ['block', /^\s*(De|From|Expéditeur)\s*:\s+\S/],
  // « -----Message d'origine----- » and its translations.
  ['block', /^\s*-{2,}\s*(Message d'origine|Message transféré|Original Message|Forwarded message)\s*-{2,}\s*$/i],
];

// « Le 10 octobre 2026 à 13:55, Marie Martin a écrit : », which Gmail wraps
// over two lines. Opening and closing are therefore looked for separately,
// and the closing is tried on one line, then two, then three.
const ATTRIBUTION_OPENS = /^\s*(Le|On)\s+\S/;
const ATTRIBUTION_CLOSES = /(a écrit|wrote)\s*:\s*$/;
const ATTRIBUTION_LINES = 3;

// Every mail client writes a date or an address in that line. Requiring one
// keeps « Le client a écrit : », which is a sentence and not a marker, from
// cutting the message at its first line.
const ATTRIBUTION_DATES = /\d|@/;

const LINE_END = /\r\n|\r|\n/;

// Characters the two languages do not class alike: a byte-order mark is a
// space for JavaScript and not for Python, and the C1 separators are the
// reverse. None of them belongs in a reply, and leaving them in would make the
// two extracts of this entry cut at different places.
const ODD_SPACES = /[\ufeff\x1c-\x1f\x85]/g;

/**
 * The text above the first quote marker, and what was found under it.
 *
 * `reason` is set when the reply looks like it was written under the quote or
 * inside it: the cut then returns almost nothing, and « almost nothing » must
 * not be handed back as « the reply was empty ». What the attribution line
 * itself holds is not counted as text written under the quote — it is the
 * dressing of the quote, and it is sixty-nine characters long, which is
 * longer than most business replies.
 *
 * `quoted_from_line` counts lines in the message split on CR, LF and CRLF, and
 * on those only — not the way `String.prototype.split(/\s/)` or Python's
 * `str.splitlines()` would do it. A caller that uses the number splits the
 * same way, with the regular expression named below.
 */
export function extractReply(message) {
  if (typeof message !== 'string') {
    return report('', null, `expected text, not ${typeof message}`);
  }

  const lines = message.replace(ODD_SPACES, '').split(LINE_END);
  const [cut, kind, dressing] = firstMarker(lines);
  if (cut === null) return report(message.trim(), null, null);

  const reply = lines.slice(0, cut).join('\n').trim();
  if (kind === 'quoted' && unquotedUnder(lines.slice(cut + dressing)) > reply.length) {
    return report(reply, cut, 'more text was written under the quote than above it');
  }
  return report(reply, cut, null);
}

/**
 * Where the quoted thread begins, how the old message is marked, and how many
 * lines the marker itself takes.
 *
 * The third number is what keeps the attribution out of the count of what was
 * written under the quote: a `>` prefix is already dropped by the filter, an
 * attribution is not.
 */
function firstMarker(lines) {
  for (let index = 0; index < lines.length; index += 1) {
    for (const [kind, marker] of MARKERS) {
      if (marker.test(lines[index])) return [index, kind, 0];
    }
    if (ATTRIBUTION_OPENS.test(lines[index])) {
      for (let length = 1; length <= ATTRIBUTION_LINES; length += 1) {
        const window = lines.slice(index, index + length).join(' ').replace(/\s+$/, '');
        if (ATTRIBUTION_CLOSES.test(window) && ATTRIBUTION_DATES.test(window)) {
          return [index, 'quoted', length];
        }
      }
    }
  }
  return [null, null, 0];
}

/** How much text under the cut carries no quote prefix. */
function unquotedUnder(lines) {
  const loose = lines.filter((line) => line.trim() && !line.trimStart().startsWith('>'));
  return loose.join('\n').trim().length;
}

function report(reply, quotedFromLine, reason) {
  return { reply, quoted_from_line: quotedFromLine, reason };
}
