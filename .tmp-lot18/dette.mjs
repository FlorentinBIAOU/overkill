import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import matter from 'gray-matter';
import { pointsDeRupture, MAX_PHRASES, MAX_MOTS } from '../scripts/check-longueur-rupture.mjs';

const dette = [];
const fichiers = (await readdir('content/entries')).filter(f=>f.endsWith('.mdx')&&!f.startsWith('_'));
for (const f of fichiers.sort()) {
  const { data } = matter(await readFile(join('content/entries', f),'utf8'));
  if (data.status !== 'published') continue;
  for (const p of pointsDeRupture(data)) {
    if (p.phrases > MAX_PHRASES || p.mots > MAX_MOTS) dette.push(p.cle);
  }
}
await writeFile('scripts/dette-rupture.json', JSON.stringify({
  _commentaire: [
    "Dette de la règle R11 (breaking_point : deux phrases, soixante mots), relevée le",
    "2026-09-20 sur les 50 fiches publiées. Ce fichier ne peut que diminuer :",
    "check-longueur-rupture échoue si une ligne y reste alors que le point de rupture",
    "tient désormais dans la limite, et il échoue si un dépassement n'y figure pas.",
    "Un point de rupture nouveau ou réécrit respecte R11 ; il ne s'ajoute pas ici."
  ],
  dette
}, null, 2) + '\n');
console.log(dette.length);
