/**
 * Reject spam in a contact form: honeypot, submission delay, link cap, banned
 * phrases.
 *
 * Rung N0. Four checks, no dependency, no training data, and a rejection that
 * comes with a reason you can show to whoever asks why a message was lost.
 *
 * Two of the checks look at the sender rather than the text. A honeypot field,
 * hidden in the form and left empty by every human being, and the time spent
 * on the page, catch the scripts that post to the endpoint without ever
 * rendering it. That is the bulk of the traffic, and no amount of reading the
 * message would have caught it any better.
 *
 * The two text checks are the weak half, and the entry says so.
 */

// The field is present in the form, hidden by the stylesheet, and named after
// something a naive form filler will want to complete.
export const HONEYPOT_FIELD = 'website';

export const MINIMUM_SECONDS = 3;
export const MAXIMUM_LINKS = 2;

const LINK = /https?:\/\/|www\.|\b[\w-]+\.(?:com|net|org|ru|xyz|top)\b/g;

// Phrases that no customer of this form has ever written, and that the trade
// they come from cannot do without.
const BANNED = /backlink|guest post|seo (?:services|ranking)|casino|crypto|viagra/g;

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
  if (secondsOnPage < MINIMUM_SECONDS) found.push('submitted too fast');

  const message = fold(fields.message ?? '');
  if ((message.match(LINK) ?? []).length > MAXIMUM_LINKS) found.push('too many links');
  for (const phrase of [...new Set(message.match(BANNED) ?? [])].sort()) {
    found.push(`banned phrase: ${phrase}`);
  }
  return found;
}

/** The same decision, for callers that only want the verdict. */
export function isSpam(fields, secondsOnPage) {
  return reasons(fields, secondsOnPage).length > 0;
}
