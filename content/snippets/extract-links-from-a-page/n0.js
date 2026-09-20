/**
 * The links of a page, resolved to absolute addresses the way a browser does it.
 *
 * Rung N0. An href is an attribute: reading it is parsing, not inference. The
 * work is elsewhere, and it is in two places.
 *
 * The first is the base. A relative href means nothing on its own, and what it
 * is relative to is not in the page: it is the address the page was served
 * from, which only the caller knows. It is therefore required, not guessed —
 * and the `<base href>` element, when the page carries one, replaces it, which
 * is the first thing to check when every link comes out wrong.
 *
 * The second is that the two languages do not resolve alike, and this entry
 * measures seven places where they part. `urllib.parse.urljoin` follows
 * RFC 3986; `new URL` follows the WHATWG standard, which is what browsers
 * actually do, and the difference is not cosmetic: on `href="\\chemin"`,
 * RFC 3986 gives a path of your own site and the WHATWG standard gives the
 * host `chemin`. Since the question being asked is « where will the reader
 * land », this file is the reference the other one had to be brought up to:
 * `new URL` already is the browser.
 */

import { parseHTML } from 'linkedom';

// The schemes a browser treats as « special ». The URL class leaves their
// default port out on its own.
export const SPECIAL = new Set(['http:', 'https:', 'ws:', 'wss:', 'ftp:']);

// What is never an address, whatever it is written in.
const NOT_ADDRESSES = new Set(['javascript:', 'data:', 'blob:', 'about:']);

const SPACES = /\s+/g;

/**
 * Every anchor of `html`, with its address resolved against `base`.
 *
 * `base` is the address the page was served from. It is required: a relative
 * href resolved against a guess is a valid address pointing somewhere else.
 */
export function extractLinks(html, base) {
  if (typeof html !== 'string' || typeof base !== 'string' || !base.trim()) {
    return {
      links: [],
      skipped: [],
      base: null,
      reason: 'the address the page was served from is required',
    };
  }

  const { document } = parseHTML(html);
  const declared = document.querySelector('base[href]')?.getAttribute('href');
  let used;
  try {
    used = declared ? new URL(declared, base).href : new URL(base).href;
  } catch {
    return { links: [], skipped: [], base: null, reason: 'the base is not an address' };
  }

  const links = [];
  const skipped = [];
  for (const anchor of document.querySelectorAll('a')) {
    const href = anchor.hasAttribute('href') ? anchor.getAttribute('href') : null;
    if (href === null || !href.trim()) {
      skipped.push({ href, why: 'no address' });
      continue;
    }
    let url;
    try {
      url = new URL(href, used);
    } catch {
      skipped.push({ href, why: 'not an address' });
      continue;
    }
    if (NOT_ADDRESSES.has(url.protocol)) {
      skipped.push({ href, why: `${url.protocol.slice(0, -1)} is not an address` });
      continue;
    }
    links.push({
      href,
      url: url.href,
      text: (anchor.textContent ?? '').replace(SPACES, ' ').trim(),
      rel: anchor.hasAttribute('rel') ? anchor.getAttribute('rel') : null,
      kind: kindOf(url, used),
    });
  }
  return { links, skipped, base: used, reason: null };
}

function kindOf(url, base) {
  if (!SPECIAL.has(url.protocol)) {
    return { 'mailto:': 'mail', 'tel:': 'phone' }[url.protocol] ?? 'other';
  }
  return url.href.split('#')[0] === base.split('#')[0] ? 'anchor' : 'page';
}
