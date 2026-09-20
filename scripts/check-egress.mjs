#!/usr/bin/env node
/**
 * Un extrait qui ouvre une connexion ne déclare pas `data_egress: none`.
 *
 *   « `data_egress: none` sur un niveau qui appelle `api.pwnedpasswords.com` a
 *     traversé la rédaction, les tests, le relevé et les contrôles. Le champ
 *     est pourtant affiché comme badge et sert de filtre au catalogue. »
 *
 * Le bloc `risks` n'est confronté à rien : il est écrit à la main, relu à la
 * main, et rien dans le dépôt ne le compare au code qu'il décrit. Un lecteur
 * qui filtre le catalogue sur « aucune donnée ne sort » attend une garantie,
 * pas une intention.
 *
 * Le contrôle lit le code de chaque niveau disponible dont le bloc `risks`
 * annonce `data_egress: none`, et y cherche ce qui ouvre une connexion : une
 * primitive réseau, un client de fournisseur, ou une adresse `http(s)`.
 *
 * ## Les deux adresses qui n'appellent rien
 *
 * Suivre à la lettre « une adresse http(s) » donnait deux fausses alertes sur
 * trois, et aucune des deux n'est une connexion :
 *
 *   - un espace de noms XML — `http://www.w3.org/2000/svg` dans un SVG écrit
 *     par l'extrait — est un identifiant, que personne ne déréférence ;
 *   - un domaine d'exemple réservé par la RFC 2606 — `example.com` — est une
 *     donnée de test, ici dans le motif d'un détecteur de pourriel.
 *
 * Les deux sont écartés, et rien d'autre : une adresse de fournisseur reste
 * refusée même si elle n'est jamais appelée, parce qu'écrire l'adresse est
 * déjà annoncer l'intention.
 *
 * ## La dette
 *
 * Une seule fiche est prise le jour où ce contrôle est écrit, et c'est celle
 * que le relecteur nomme. Elle est déclarée dans `scripts/dette-egress.json`
 * le temps que le lot 18 la corrige ; la liste ne peut que diminuer, et elle
 * doit être vide à la fin du lot.
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';

const FICHES = process.env.OVERKILL_ENTRIES ?? 'content/entries';
const CONTENU = process.env.OVERKILL_CONTENT ?? 'content';
const DETTE = 'scripts/dette-egress.json';

/** Ce qui, dans du code, ouvre une connexion. */
export const SIGNES = [
  { nom: 'adresse HTTP', motif: /https?:\/\/[^\s'"`)\\]+/g },
  { nom: 'urllib.request', motif: /\burllib\.request\b/g },
  { nom: 'requests', motif: /^\s*import\s+requests\b/gm },
  { nom: 'httpx', motif: /^\s*import\s+httpx\b/gm },
  { nom: 'http.client', motif: /\bhttp\.client\b/g },
  { nom: 'socket', motif: /^\s*import\s+socket\b/gm },
  { nom: 'fetch', motif: /\bfetch\s*\(/g },
  { nom: 'XMLHttpRequest', motif: /\bXMLHttpRequest\b/g },
  { nom: 'client de fournisseur', motif: /\b[Pp]roviderClient\s*\(/g },
];

/**
 * Les adresses qui ne sont pas des connexions : un espace de noms XML, et les
 * domaines que la RFC 2606 réserve aux exemples.
 */
const ADRESSES_INERTES = [
  /^https?:\/\/(?:www\.)?w3\.org\//,
  /^https?:\/\/(?:www\.)?purl\.org\//,
  /^https?:\/\/schemas\.openxmlformats\.org\//,
  /^https?:\/\/[^/]*\bexample\.(?:com|org|net)\b/,
  /^https?:\/\/[^/]*\.(?:invalid|test|localhost)\b/,
  /^https?:\/\/localhost\b/,
];

/** Ce qui, dans une source, trahit une sortie de données. */
export function sortiesDe(source) {
  const trouves = [];
  for (const { nom, motif } of SIGNES) {
    motif.lastIndex = 0;
    for (const m of source.matchAll(motif)) {
      if (nom === 'adresse HTTP' && ADRESSES_INERTES.some((inerte) => inerte.test(m[0]))) continue;
      trouves.push({ nom, extrait: m[0].slice(0, 60) });
    }
  }
  return trouves;
}

// ------------------------------------------------------------------ exécution

if (import.meta.url === `file://${process.argv[1]}`) {
  const dette = new Set(JSON.parse(await readFile(DETTE, 'utf8')).dette);
  const fichesEnDette = new Set();
  const trouvailles = [];
  const vues = new Set();
  let niveaux = 0;

  const fichiers = (await readdir(FICHES)).filter((f) => f.endsWith('.mdx') && !f.startsWith('_')).sort();
  for (const fichier of fichiers) {
    const { data } = matter(await readFile(join(FICHES, fichier), 'utf8'));
    if (data.status !== 'published') continue;

    for (const rung of data.rungs ?? []) {
      if (!rung.available || rung.risks?.data_egress !== 'none') continue;
      niveaux += 1;
      for (const [langage, chemin] of Object.entries(rung.code ?? {})) {
        if (langage === 'verification' || typeof chemin !== 'string') continue;
        const sur = join(CONTENU, chemin);
        if (!existsSync(sur)) continue;
        for (const sortie of sortiesDe(await readFile(sur, 'utf8'))) {
          if (dette.has(data.id)) { fichesEnDette.add(data.id); continue; }
          /* Une même primitive citée dix fois est une seule sortie. */
          const cle = `${data.id}|${rung.level}|${chemin}|${sortie.nom}`;
          if (vues.has(cle)) continue;
          vues.add(cle);
          trouvailles.push({ id: data.id, level: rung.level, chemin, ...sortie });
        }
      }
    }
  }

  const perimees = [...dette].filter((id) => !fichesEnDette.has(id));

  if (trouvailles.length || perimees.length) {
    console.error(`\ncheck-egress : ${trouvailles.length + perimees.length} problème(s)\n`);
    for (const t of trouvailles) {
      console.error(`  ✗ ${t.id} ${t.level}  ${t.chemin}  [${t.nom}]`);
      console.error(`      ${t.extrait}`);
    }
    for (const id of perimees) {
      console.error(`  ✗ ${id}  ligne de dette périmée : plus aucune sortie sur un niveau « none »`);
      console.error(`      retirer la ligne de ${DETTE}`);
    }
    if (trouvailles.length) console.error(
      '\n  Le schéma propose « own-infra » et « third-party ». Le champ est affiché\n' +
        '  comme badge et sert de filtre au catalogue : il dit ce que le code fait.\n',
    );
    process.exit(1);
  }

  console.log(
    `check-egress : OK — ${niveaux} niveau(x) déclarent « data_egress: none » ; ` +
      `${dette.size} fiche(s) encore en dette`,
  );
}
