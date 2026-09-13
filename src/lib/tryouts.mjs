/**
 * Les essais : chargement et exécution à la construction du site.
 *
 * Un essai est un module de `content/tryouts/`, à côté du contenu et non dans
 * le code du site, parce que c'est du contenu : il décrit ce qu'on donne à
 * l'extrait d'une fiche et ce qu'on en attend.
 *
 *   content/tryouts/live/<id>.js    l'extrait tourne dans le navigateur
 *   content/tryouts/frozen/<id>.js  il ne peut pas, les sorties sont calculées
 *                                   ici, au build, en exécutant le vrai code
 *
 * Dans les deux cas c'est le vrai fichier d'extrait qui est importé, jamais
 * une copie : la règle de vérité du code (CDC 4.6) vaut aussi pour les essais.
 * Une sortie écrite à la main serait une affirmation non vérifiée, donc
 * interdite (interdit 2).
 */
import { bilingual, caseInput } from './tryout-case.mjs';

const LIVE = import.meta.glob('../../content/tryouts/live/*.js', { eager: true });
const FROZEN = import.meta.glob('../../content/tryouts/frozen/*.js', { eager: true });

function index(modules, prefix) {
  const out = {};
  for (const [chemin, mod] of Object.entries(modules)) {
    const id = chemin.slice(chemin.lastIndexOf('/') + 1, -3);
    out[id] = { id, mode: prefix, spec: mod.default };
  }
  return out;
}

const LIVES = index(LIVE, 'live');
const FROZENS = index(FROZEN, 'frozen');

/**
 * L'essai d'une fiche, ou `null` si elle n'en a pas. Une fiche sans essai
 * n'affiche pas de zone d'essai, et ne dit rien à ce sujet : toutes les
 * tâches ne se montrent pas dans un champ de saisie.
 */
export function tryoutFor(id) {
  const trouve = LIVES[id] ?? FROZENS[id] ?? null;
  if (trouve && !trouve.spec) {
    throw new Error(`l'essai ${id} n'exporte pas de spécification par défaut`);
  }
  return trouve;
}

/**
 * Exécute un cas. L'erreur est rendue, pas avalée : un essai qui casse doit
 * se voir à la construction du site, et se lire sur la page plutôt que de
 * laisser un trou.
 */
async function runCase(spec, cas, lang) {
  const entree = caseInput(cas, lang);
  /* Le cas lui-même est passé en troisième argument : la forme figée en a
     besoin, parce que plusieurs de ses cas partagent la même entrée et ne se
     distinguent que par ce qu'on simule autour — un fournisseur qui échoue,
     une réponse mal formée. La forme interactive, elle, ne peut pas s'appuyer
     dessus : quand la personne tape son propre texte, il n'y a pas de cas. */
  const resultat = await spec.run(entree, lang, cas);
  return {
    input: entree,
    /* Ce qu'on affiche à la place de l'entrée quand celle-ci ne s'affiche pas :
       un document de quarante mille caractères se décrit. */
    shown: bilingual(cas.shown, lang),
    label: bilingual(cas.label, lang),
    fails: Boolean(cas.fails),
    why: bilingual(cas.why, lang),
    result: resultat,
  };
}

/** Tous les cas d'un essai, exécutés. Employé par la forme figée. */
export async function runAll(spec, lang) {
  const out = [];
  for (const cas of spec.cases) out.push(await runCase(spec, cas, lang));
  return out;
}

/** Le premier cas d'un essai, exécuté : ce que la page montre au chargement. */
export async function runFirst(spec, lang) {
  return runCase(spec, spec.cases[0], lang);
}

/** Les cas, sans les exécuter : ce dont les boutons ont besoin. */
export function caseList(spec, lang) {
  return spec.cases.map((cas) => ({
    input: caseInput(cas, lang),
    label: bilingual(cas.label, lang),
    fails: Boolean(cas.fails),
    why: bilingual(cas.why, lang),
  }));
}
