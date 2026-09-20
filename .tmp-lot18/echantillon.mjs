import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
const noms = (await readdir('content/entries')).filter(f=>f.endsWith('.mdx')&&!f.startsWith('_'));
const abbr = [];
for (const nom of noms) {
  const { data } = matter(await readFile(join('content/entries', nom),'utf8'));
  for (const r of data.rungs ?? []) for (const lang of ['fr','en']) {
    const t = r.breaking_point?.[lang]; if (!t) continue;
    for (const m of t.matchAll(/\S*[.!?…](?=\s|$)/g)) {
      const w = m[0];
      if (!/^[^\s]*[a-zà-ÿ0-9»)”"'’]{2,}[.!?…]$/i.test(w) || /^(etc|cf|ex|p|al|vs|no|nos|Mr|Mrs|Dr|St|approx|Inc|Ltd)\.$/i.test(w)) abbr.push(w);
    }
  }
}
console.log([...new Set(abbr)].sort().join('\n'));
