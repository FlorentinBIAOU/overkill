/**
 * Lecture des extraits de code depuis le disque.
 *
 * Règle de vérité du code (CDC 4.6) : la fiche importe le fichier, elle ne
 * contient pas de code recopié à la main. Ce module est le seul chemin par
 * lequel du code entre dans une page, et il échoue bruyamment si le fichier
 * n'existe pas, plutôt que d'afficher un bloc vide.
 *
 * Une seule chose est localisée : la docstring d'en-tête, celle qui explique le
 * raisonnement. C'est le premier bloc que le lecteur voit, et la zone d'essai le
 * met encore davantage en avant. Les commentaires en ligne et les identifiants
 * restent en anglais (docs/DECISIONS-CLARTE.md, section 1).
 */
import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { parse as parseYaml } from 'yaml';

const CONTENT = resolve(process.cwd(), 'content');

export type Language = 'python' | 'javascript';

/** Langue de la page. */
export type Locale = 'en' | 'fr';

export interface Snippet {
  language: Language;
  /** Chemin relatif à `content/`, tel qu'il figure dans le frontmatter. */
  path: string;
  code: string;
  /** Vrai quand la docstring d'en-tête affichée est une traduction. */
  translated: boolean;
  /** Nom du fichier de test qui exécute cet extrait. */
  testPath: string;
}

/**
 * Les traductions de docstring d'un dossier d'extraits.
 *
 * Elles vivent à côté du code, dans `doc.fr.yaml`, et sont rangées par niveau
 * — la clé `n0` sert aux deux langages — ou par fichier quand les deux ne
 * disent pas la même chose — la clé `n0.js`. Le fichier sur le disque, celui
 * que les tests exécutent, garde sa docstring anglaise : rien n'est dupliqué.
 */
function traductions(path: string, locale: Locale): Record<string, string> {
  if (locale === 'en') return {};
  const fichier = resolve(CONTENT, dirname(path), `doc.${locale}.yaml`);
  if (!existsSync(fichier)) return {};
  return (parseYaml(readFileSync(fichier, 'utf8')) ?? {}) as Record<string, string>;
}

/** Le texte traduit pour un extrait, s'il existe. */
export function docTraduite(path: string, locale: Locale): string | undefined {
  const table = traductions(path, locale);
  const nom = path.slice(path.lastIndexOf('/') + 1);
  const niveau = nom.slice(0, nom.indexOf('.'));
  return table[nom] ?? table[niveau];
}

const DOC_PYTHON = /^(\s*)("""|''')([\s\S]*?)\2/;
const DOC_JS = /^(\s*)(\/\*\*)([\s\S]*?)\*\//;

/** Bornes de la docstring d'en-tête, ou null si l'extrait n'en a pas. */
function enTete(code: string, language: Language) {
  const m = code.match(language === 'python' ? DOC_PYTHON : DOC_JS);
  if (!m) return null;
  return { debut: m.index ?? 0, longueur: m[0].length, indent: m[1], marque: m[2] };
}

/**
 * Remplace le contenu de la docstring d'en-tête, et rien d'autre.
 *
 * Le corps du code n'est jamais touché : `scripts/check-content.mjs` le
 * vérifie caractère par caractère sur chaque extrait traduit.
 */
export function replaceHeaderDoc(code: string, language: Language, texte: string): string {
  const borne = enTete(code, language);
  if (!borne) return code;
  const lignes = texte.trim().split('\n');
  const guillemets = borne.marque === "'''" ? "'''" : '"""';
  const bloc =
    language === 'python'
      ? [guillemets, ...lignes, guillemets].join('\n')
      : ['/**', ...lignes.map((l) => (l.trim() ? ` * ${l}` : ' *')), ' */'].join('\n');
  return (
    code.slice(0, borne.debut) + borne.indent + bloc + code.slice(borne.debut + borne.longueur)
  );
}

/** Le code après la docstring d'en-tête : ce qui ne doit jamais changer. */
export function corpsApresDoc(code: string, language: Language): string {
  const borne = enTete(code, language);
  return borne ? code.slice(borne.debut + borne.longueur) : code;
}

export function readSnippet(path: string, language: Language, locale: Locale = 'en'): Snippet {
  const full = resolve(CONTENT, path);
  if (!full.startsWith(CONTENT)) {
    throw new Error(`chemin d'extrait hors de content/ : ${path}`);
  }

  let code: string;
  try {
    code = readFileSync(full, 'utf8');
  } catch {
    throw new Error(
      `extrait introuvable : ${path}\n` +
        `Une fiche ne peut pas afficher du code qui n'existe pas sur le disque (CDC 4.6).`,
    );
  }

  const extension = language === 'python' ? 'py' : 'js';
  const traduite = docTraduite(path, locale);

  return {
    language,
    path,
    code: (traduite ? replaceHeaderDoc(code, language, traduite) : code).replace(/\s+$/, ''),
    translated: Boolean(traduite),
    testPath: path.replace(new RegExp(`\\.${extension}$`), `.test.${extension}`),
  };
}
