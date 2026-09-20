import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';

const dir = 'content/entries';
const noms = (await readdir(dir)).filter(f => f.endsWith('.mdx') && !f.startsWith('_'));
let rows = [];
for (const nom of noms) {
  const { data } = matter(await readFile(join(dir, nom), 'utf8'));
  if (data.status !== 'published') continue;
  for (const r of data.rungs ?? []) {
    const bp = r.breaking_point;
    if (!bp) continue;
    for (const lang of ['fr','en']) {
      const t = bp[lang];
      if (!t) continue;
      const mots = t.trim().split(/\s+/).length;
      const phrases = (t.match(/[.!?…](?:\s|$)/g) || []).length;
      rows.push({ id: data.id, level: r.level, lang, mots, phrases });
    }
  }
}
rows.sort((a,b)=>b.mots-a.mots);
const over = rows.filter(r=>r.mots>60);
console.log(`total ${rows.length} points de rupture (fr+en), ${over.length} > 60 mots`);
const overFr = rows.filter(r=>r.lang==='fr'&&r.mots>60);
console.log(`fr: ${rows.filter(r=>r.lang==='fr').length} total, ${overFr.length} > 60 mots`);
console.log(`3+ phrases: ${rows.filter(r=>r.phrases>=3).length}`);
// fiches concernées
const fiches = new Set(rows.filter(r=>r.mots>60||r.phrases>=3).map(r=>r.id));
console.log(`fiches concernées: ${fiches.size}`);
console.log([...fiches].join('\n'));
