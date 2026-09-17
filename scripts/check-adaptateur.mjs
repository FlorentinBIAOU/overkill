#!/usr/bin/env node
/**
 * Règle T2 de la charte des tests : l'adaptateur du niveau N3 est exécuté.
 *
 *   « Le client par défaut d'un niveau N3 est du code comme un autre, et
 *     personne ne l'exécute jamais : il n'a pas de clé. Un double à la forme
 *     du kit publié le fait tourner, et c'est le seul moyen de savoir qu'il
 *     appelle une méthode qui existe. »
 *
 * Le lot 15 a trouvé, sur plusieurs fiches, un client par défaut qui appelait
 * une méthode absente du kit : l'erreur était avalée par la boucle de réessai
 * et ressortait en panne de fournisseur. Un test qui construit l'adaptateur sur
 * `content/snippets/_harness/fake_sdk.py` ou `fake-sdk.mjs` l'attrape en une
 * ligne.
 *
 * Ce contrôle vérifie donc qu'un extrait N3 publié a bien un test qui nomme son
 * adaptateur : `ProviderClient(` en Python, `providerClient(` en JavaScript.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const FICHES = 'content/entries';
const EXTRAITS = 'content/snippets';

/** Par langage : le fichier de l'extrait, celui du test, et l'appel attendu. */
const LANGAGES = [
  { extrait: 'n3.py', test: 'n3.test.py', appel: 'ProviderClient(', double: '_harness/fake_sdk.py' },
  { extrait: 'n3.js', test: 'n3.test.js', appel: 'providerClient(', double: '_harness/fake-sdk.mjs' },
];

const trouvailles = [];
let exerces = 0;

const fiches = (await readdir(FICHES)).filter((nom) => nom.endsWith('.mdx') && !nom.startsWith('_'));
for (const fichier of fiches) {
  const source = await readFile(join(FICHES, fichier), 'utf8');
  if (!/^status:\s*published\s*$/m.test(source)) continue;

  const id = fichier.replace(/\.mdx$/, '');
  for (const { extrait, test, appel, double } of LANGAGES) {
    const chemin = join(EXTRAITS, id, extrait);
    if (!existsSync(chemin)) continue;
    // Un extrait N3 sans adaptateur nommé n'a rien à exercer : certaines fiches
    // passent le client entier en paramètre, et c'est une autre façon de faire.
    if (!(await readFile(chemin, 'utf8')).includes(appel.slice(0, -1))) continue;

    const cheminTest = join(EXTRAITS, id, test);
    const teste = existsSync(cheminTest) ? await readFile(cheminTest, 'utf8') : '';
    if (teste.includes(appel)) exerces += 1;
    else trouvailles.push({ ou: cheminTest, appel, double });
  }
}

if (trouvailles.length) {
  console.error(`\ncheck-adaptateur : ${trouvailles.length} adaptateur(s) N3 jamais exécuté(s)\n`);
  for (const t of trouvailles) {
    console.error(`  ✗ ${t.ou}`);
    console.error(`      aucun test n'appelle « ${t.appel} » : le construire sur ${t.double}`);
  }
  console.error('');
  process.exit(1);
}

console.log(`check-adaptateur : OK — ${exerces} adaptateur(s) N3 exercé(s) contre le double du harnais`);
