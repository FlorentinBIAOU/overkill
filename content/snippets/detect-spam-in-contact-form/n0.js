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
 * The two text checks are the weak half, and the entry says so.
 */

// The field is present in the form, hidden by the stylesheet, and named after
// something a naive form filler will want to complete.
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
export function reasons(fields, secondsOnPage) {
  const found = [];
  if ((fields[HONEYPOT_FIELD] ?? '').trim()) found.push('honeypot filled');
  // Written as "not at least", so a missing or unreadable delay (NaN) counts
  // as too fast instead of slipping through.
  if (!(secondsOnPage >= MINIMUM_SECONDS)) found.push('submitted too fast');

  const message = fold(fields.message ?? '');
  if ((message.match(LINK) ?? []).length > MAXIMUM_LINKS) found.push('too many links');
  const phrases = new Set(Array.from(message.matchAll(BANNED), (match) => match[1]));
  for (const phrase of [...phrases].sort()) found.push(`banned phrase: ${phrase}`);
  return found;
}

/** The same decision, for callers that only want the verdict. */
export function isSpam(fields, secondsOnPage) {
  return reasons(fields, secondsOnPage).length > 0;
}
