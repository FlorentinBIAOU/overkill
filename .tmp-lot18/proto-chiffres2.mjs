import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const ESPACE = '[\\u00a0\\u202f ]';
const NOMBRE = new RegExp(
  `(?<![\\p{L}\\d.,-])\\d{1,3}(?:${ESPACE}\\d{3})*(?:[.,]\\d+)?(?![\\d])`, 'gu');
const REFERENCE = /(?:RFC|ISO|NIST|SP|EN|NF|UTF|SHA|ECMA|IEEE|Unicode|version|norme|standard|numéro|n°|N)\s*$/i;
const MESURE = [
  { nom:'pourcentage', apres: /^\s*%/ },
  { nom:'facteur', avant: /[×x]\s*$/ },
  { nom:'facteur', apres: /^\s*fois\b/ },
];

const noms = (await readdir('content/entries')).filter(f=>f.endsWith('.mdx')&&!f.startsWith('_'));
let tot=0, abs=0; const parFiche={};
const pousserTextes = (data) => { const out=[];
  const p = (o)=>{ if(o&&typeof o==='object') for(const l of ['fr','en']) if(typeof o[l]==='string') out.push(o[l]); };
  p(data.scenario); p(data.verdict_rationale);
  for (const r of data.rungs??[]) { p(r.name); p(r.breaking_point); p(r.escalate_when); p(r.unavailable_reason); }
  return out; };

for (const nom of noms) {
  const { data } = matter(await readFile(join('content/entries', nom),'utf8'));
  if (data.status !== 'published') continue;
  const dossier = join('content/snippets', data.id);
  if (!existsSync(dossier)) continue;
  const fichiers = (await readdir(dossier)).filter(f=>/\.test\.(py|js)$/.test(f));
  const tests = (await Promise.all(fichiers.map(f=>readFile(join(dossier,f),'utf8')))).join('\n');
  const vus = new Set();
  for (const t of pousserTextes(data)) {
    for (const m of t.matchAll(NOMBRE)) {
      const brut = m[0];
      const avant = t.slice(Math.max(0,m.index-14), m.index);
      const apres = t.slice(m.index+brut.length, m.index+brut.length+8);
      const norm = brut.replace(new RegExp(ESPACE,'gu'),'').replace(',', '.');
      const valeur = Number(norm);
      // portée
      const estMesure = MESURE.some(x => (x.avant?x.avant.test(avant):true) && (x.apres?x.apres.test(apres):true) && (x.avant||x.apres));
      const decimal = /[.,]/.test(brut);
      const separe = new RegExp(ESPACE,'u').test(brut);
      const grand = !decimal && !separe && norm.replace(/^0+/,'').length >= 3;
      if (!estMesure && !decimal && !separe && !grand) continue;
      // exclusions
      if (!decimal && !separe && valeur >= 1900 && valeur <= 2099 && !/%\s*$/.test(apres)) continue;
      if (REFERENCE.test(avant)) continue;
      if (vus.has(norm)) continue; vus.add(norm);
      tot++;
      const variantes = [norm, norm.replace('.', ','), brut, brut.replace(new RegExp(ESPACE,'gu'),'')];
      if (!variantes.some(v=>tests.includes(v))) { abs++; (parFiche[data.id]??=[]).push(`${brut} — « …${t.slice(Math.max(0,m.index-45), m.index+18)}… »`); }
    }
  }
}
console.log(`nombres en portée ${tot}, absents ${abs}, fiches ${Object.keys(parFiche).length}`);
for (const [id,l] of Object.entries(parFiche)) { console.log('\n## '+id); l.slice(0,6).forEach(x=>console.log('   '+x)); if(l.length>6) console.log('   … '+(l.length-6)); }
