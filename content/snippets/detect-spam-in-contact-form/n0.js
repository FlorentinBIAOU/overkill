/**
 * Reject spam in a contact form: honeypot, submission delay, link cap, banned
 * phrases.
 *
 * Rung N0. Four checks, no dependency, no training data, and a rejection that
 * comes with a reason you can show to whoever asks why a message was lost.
 *
 * Two of the checks look at the sender rather than the text. A honeypot field,
 * kept out of sight in the form, and the time spent on the page catch the
 * scripts that post to the endpoint without rendering it, as long as they fill
 * in every field or post faster than a person types. Neither needs to read the
 * message.
 *
 * The delay is the one that has to be built right, and it is where this kind
 * of check is usually got wrong. A hidden field holding the time the page was
 * rendered is a number the sender writes, and a script writes whatever it
 * likes in it. So the server issues that timestamp itself, signed with a
 * secret only it holds, and recomputes the signature on submission: a
 * timestamp that was edited, or that nobody signed, is not a delay at all, and
 * counts as too fast. Thirty lines below, and nothing but `node:crypto`. Ned
 * Batchelder's spinner, which this follows, signs the visitor's address and the
 * page identifier along with the time, so that a token issued for one form
 * cannot be replayed on another.
 *
 * The two text checks are the weak half, and the entry says so.
 */
import { createHmac, timingSafeEqual } from 'node:crypto';

// The field is present in the form and hidden by the stylesheet — not with
// `type="hidden"`, which a script knows to skip — and named after something a
// naive form filler will want to complete.
export const HONEYPOT_FIELD = 'website';

export const MINIMUM_SECONDS = 3;
export const MAXIMUM_LINKS = 2;

// One match per link, not one per part: a bare `https?://` alternative would
// count `http://example.com` twice and reject the customer who sends two.
// A bare domain must start a word that follows neither `@` nor a dot, so the
// domain of an email address is not a link, and a run like `a-a-a-...` gives
// the pattern one place to start instead of one per letter.
const LINK = /(?:https?:\/\/|www\.)\S+|(?<![\w@.-])[\w-]+(?:\.[\w-]+)*\.(?:com|net|org|ru|xyz|top)\b/g;

// Whole words only, so `cryptographie` or a shop called `Casino` is not
// rejected. Every word on such a list is one a customer may write some day.
const BANNED = /\b(backlink|guest post|seo (?:services|ranking)|online casino|viagra)s?\b/g;

/**
 * The timestamp to put in the form, signed: `<seconds>.<signature>`.
 *
 * `secret` never leaves the server. Anything else the form carries about time
 * is the sender's word.
 */
export function issueToken(secret, issuedAt = Date.now() / 1000) {
  const issued = Math.floor(issuedAt);
  return `${issued}.${signature(secret, issued)}`;
}

/**
 * How long the form was really on the page, or zero when the token is not ours.
 *
 * Zero is the safe answer: `reasons` reads it as too fast. A token that was
 * edited, replayed with a different time, or made up, lands here.
 */
export function secondsOnPage(token, secret, now = Date.now() / 1000) {
  const [issuedText = '', given = ''] = String(token).split('.');
  if (!/^\d+$/.test(issuedText)) return 0;
  const expected = Buffer.from(signature(secret, Number(issuedText)));
  const offered = Buffer.from(given);
  if (offered.length !== expected.length || !timingSafeEqual(offered, expected)) return 0;
  return Math.max(0, now - Number(issuedText));
}

function signature(secret, issued) {
  return createHmac('sha256', secret).update(String(issued)).digest('hex');
}

/** Lowercase and strip accents, so `Rétrolien` and `RETROLIEN` match alike. */
export function fold(text) {
  return text.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/**
 * Every reason to reject this submission. An empty list means: accept it.
 *
 * Returning reasons rather than a boolean is what makes the rule reviewable:
 * a rejection you cannot explain is a rejection you cannot tune.
 */
export function reasons(fields, seconds) {
  const found = [];
  if ((fields[HONEYPOT_FIELD] ?? '').trim()) found.push('honeypot filled');
  // Written as "not at least", so a missing or unreadable delay (NaN) counts
  // as too fast instead of slipping through.
  if (!(seconds >= MINIMUM_SECONDS)) found.push('submitted too fast');

  const message = fold(fields.message ?? '');
  if ((message.match(LINK) ?? []).length > MAXIMUM_LINKS) found.push('too many links');
  const phrases = new Set(Array.from(message.matchAll(BANNED), (match) => match[1]));
  for (const phrase of [...phrases].sort()) found.push(`banned phrase: ${phrase}`);
  return found;
}

/** The same decision, for callers that only want the verdict. */
export function isSpam(fields, seconds) {
  return reasons(fields, seconds).length > 0;
}
