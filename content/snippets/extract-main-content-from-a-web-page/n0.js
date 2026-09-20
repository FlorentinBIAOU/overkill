/**
 * Keep the article and drop everything around it.
 *
 * Rung N0. Separating the body of a page from its menus, its footer, its
 * cookie banner and its « you may also like » is a solved problem with a name
 * — boilerplate removal — and two mature implementations: Mozilla's
 * `Readability` here, `trafilatura` in Python. Both work on the tag tree,
 * weighing text density against link density, and both run offline in a few
 * milliseconds.
 *
 * They are not the same algorithm and they do not return the same characters.
 * The titles differ, the line breaks differ, and one keeps the heading inside
 * the body while the other puts it in the title. What they agree on is the
 * part that matters, and the test of this entry says it that way: the
 * article's sentences are in, the navigation and the footer are out.
 *
 * Two things this file adds. The first is the refusal to hand back an empty
 * string as if it were an answer: a page whose body is built by its own
 * JavaScript arrives here as an empty shell, and « nothing extracted » is a
 * different thing from « this article is short ».
 *
 * The second settles a disagreement between the two libraries. On a category
 * page — forty links and nothing else — `trafilatura` returns nothing and
 * `Readability` returns the link text as though it were an article. So the
 * share of the page's text that sits inside links is measured here, in both
 * languages, and above half the page is not an article whatever the extractor
 * said.
 */

import { Readability } from '@mozilla/readability';
// `Readability` needs a document, and Node has none. `linkedom` builds one
// without a browser engine; `jsdom` would do as well and costs more to start.
import { parseHTML } from 'linkedom';

// Under this many characters, what came out is a caption, a teaser or the
// leftovers of a page that had no body to begin with. An article in the press,
// a documentation page or a blog post is an order of magnitude above.
export const MIN_CHARACTERS = 200;

// Above this share of the page's text inside links, the page is a list of
// links — a category, an index, a tag page — and not an article. Measured
// rather than guessed, because the two extractors do not agree on their own.
export const MAX_LINK_SHARE = 0.5;

/**
 * The body of the page, its title, and whether it is worth reading.
 *
 * `reason` is what tells a caller that came back empty-handed whether the page
 * was short or whether there was nothing to take — the second is what happens
 * on a page rendered in the browser, and it calls for another tool, not for a
 * better extractor.
 *
 * @param {string} html
 * @param {{minCharacters?: number}} [options]
 */
export function readArticle(html, { minCharacters = MIN_CHARACTERS } = {}) {
  if (typeof html !== 'string') {
    return report(null, '', `expected HTML, not ${kindOf(html)}`);
  }
  let article;
  let fallbackTitle = null;
  let share = 0;
  try {
    const { document } = parseHTML(html);
    // Both kept before parsing: `Readability` empties the document as it works.
    fallbackTitle = document.title || null;
    share = linkShare(document);
    article = new Readability(document).parse();
  } catch {
    return report(null, '', 'this page could not be parsed');
  }

  const title = article?.title || fallbackTitle;
  if (share > MAX_LINK_SHARE) {
    return report(title, '', 'this page is a list of links, not an article');
  }
  const text = (article?.textContent ?? '').trim();
  if (text.length < minCharacters) {
    return report(title, text,
      'almost nothing was extracted: this page may be built by its own JavaScript');
  }
  return report(title, text, null);
}

/** What share of the page's text sits inside a link. */
function linkShare(document) {
  for (const element of document.querySelectorAll('script, style')) element.textContent = '';
  const total = (document.documentElement?.textContent ?? '').trim().length;
  const inside = [...document.querySelectorAll('a')]
    .reduce((n, link) => n + (link.textContent ?? '').length, 0);
  return total ? inside / total : 0;
}

const kindOf = (value) => (value === null ? 'null' : typeof value);

const report = (title, text, reason) => ({
  title, text, characters: text.length, reason,
});
