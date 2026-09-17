#!/usr/bin/env node
/**
 * Règle T1 de la charte des tests : une fiche publiée ne garde aucun marquage.
 *
 *   « Un test marqué dit que la fiche ment quelque part. Tant qu'il est là,
 *     la fiche n'est pas finie. »
 *
 * Un marquage est un test que le lot précédent a laissé en échec attendu :
 * `xfail(strict=True)` en Python, un `assert.rejects` autour du corps en
 * JavaScript, et le mot `INFIRMÉ` ou `DÉFAUT` dans sa raison. Ils servent à
 * transmettre un relevé d'un tour au suivant ; sur une fiche publiée, ils
 * mentent deux fois : ils n'exécutent plus rien d'utile — un `xfail` strict
 * passe dès que le corps lève, pour n'importe quelle raison — et ils laissent
 * croire que le défaut est connu, donc traité.
 *
 * Ce contrôle ne regarde que les fiches `published`. Un brouillon a le droit
 * de porter ses marquages : c'est même à cela qu'il sert.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const FICHES = 'content/entries';
const EXTRAITS = 'content/snippets';

/** Ce qu'on cherche dans un fichier de test, et comment le dire. */
const MARQUAGES = [
  { nom: 'xfail', motif: /@pytest\.mark\.xfail\b/g },
  { nom: 'INFIRMÉ', motif: /INFIRMÉ/g },
  { nom: 'DÉFAUT', motif: /DÉFAUT/g },
];

const trouvailles = [];

const fiches = (await readdir(FICHES)).filter((nom) => nom.endsWith('.mdx') && !nom.startsWith('_'));
for (const fichier of fiches) {
  const source = await readFile(join(FICHES, fichier), 'utf8');
  // Le statut est en tête du frontmatter, une ligne à lui seul.
  if (!/^status:\s*published\s*$/m.test(source)) continue;

  const id = fichier.replace(/\.mdx$/, '');
  const dossier = join(EXTRAITS, id);
  if (!existsSync(dossier)) continue;

  for (const nom of (await readdir(dossier)).filter((f) => /\.test\.(py|js)$/.test(f))) {
    const chemin = join(dossier, nom);
    const lignes = (await readFile(chemin, 'utf8')).split('\n');
    lignes.forEach((ligne, i) => {
      for (const marquage of MARQUAGES) {
        marquage.motif.lastIndex = 0;
        if (marquage.motif.test(ligne)) {
          trouvailles.push({ ou: `${chemin}:${i + 1}`, nom: marquage.nom, extrait: ligne.trim().slice(0, 100) });
        }
      }
    });
  }
}

if (trouvailles.length) {
  console.error(`\ncheck-marquages : ${trouvailles.length} marquage(s) sur une fiche publiée\n`);
  for (const t of trouvailles) {
    console.error(`  ✗ ${t.ou}  [${t.nom}]`);
    console.error(`      ${t.extrait}`);
  }
  console.error('\n  Corriger le code ou la phrase, puis réécrire le test sur ce qu\'il démontre ;');
  console.error('  ou repasser la fiche en « status: draft » avec la raison.\n');
  process.exit(1);
}

console.log(`check-marquages : OK — ${fiches.length} fiche(s) lue(s), aucun marquage sur une fiche publiée`);
