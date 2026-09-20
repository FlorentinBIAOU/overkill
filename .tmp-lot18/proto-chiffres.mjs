import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const CHAMPS = ['scenario','name','breaking_point','escalate_when','unavailable_reason','verdict_rationale'];
function textes(data) {
  const out = [];
  const pousser = (o) => { if (o && typeof o === 'object') for (const l of ['fr','en']) if (typeof o[l] === 'string') out.push(o[l]); };
  pousser(data.scenario); pousser(data.verdict_rationale);
  for (const r of data.rungs ?? []) { pousser(r.name); pousser(r.breaking_point); pousser(r.escalate_when); pousser(r.unavailable_reason); }
  return out;
}
const noms = (await readdir('content/entries')).filter(f=>f.endsWith('.mdx')&&!f.startsWith('_'));
let tot=0, abs=0; const parFiche={};
for (const nom of noms) {
  const { data } = matter(await readFile(join('content/entries', nom),'utf8'));
  if (data.status !== 'published') continue;
  const dossier = join('content/snippets', data.id);
  if (!existsSync(dossier)) continue;
  const fichiers = (await readdir(dossier)).filter(f=>/\.test\.(py|js)$/.test(f));
  const tests = (await Promise.all(fichiers.map(f=>readFile(join(dossier,f),'utf8')))).join('\n');
  const vus = new Set();
  for (const t of textes(data)) {
    for (const m of t.matchAll(/\d[\d   ]*(?:[.,]\d+)?/g)) {
      const brut = m[0].trim();
      const norm = brut.replace(/[\s  ]/g,'').replace(',', '.');
      if (norm.length < 1) continue;
      if (vus.has(norm)) continue; vus.add(norm);
      tot++;
      const variantes = [norm, norm.replace('.', ','), brut];
      if (!variantes.some(v=>tests.includes(v))) { abs++; (parFiche[data.id]??=[]).push(`${brut} — « …${t.slice(Math.max(0,m.index-40), m.index+20)}… »`); }
    }
  }
}
console.log(`nombres ${tot}, absents des tests ${abs}, fiches ${Object.keys(parFiche).length}`);
for (const [id,l] of Object.entries(parFiche)) { console.log('\n## '+id); l.slice(0,5).forEach(x=>console.log('   '+x)); if(l.length>5) console.log('   … '+(l.length-5)); }
