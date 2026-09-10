/**
 * Lecture des extraits de code depuis le disque.
 *
 * Règle de vérité du code (CDC 4.6) : la fiche importe le fichier, elle ne
 * contient pas de code recopié à la main. Ce module est le seul chemin par
 * lequel du code entre dans une page, et il échoue bruyamment si le fichier
 * n'existe pas, plutôt que d'afficher un bloc vide.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const CONTENT = resolve(process.cwd(), 'content');

export type Language = 'python' | 'javascript';

export interface Snippet {
  language: Language;
  /** Chemin relatif à `content/`, tel qu'il figure dans le frontmatter. */
  path: string;
  code: string;
  /** Nom du fichier de test qui exécute cet extrait. */
  testPath: string;
}

export function readSnippet(path: string, language: Language): Snippet {
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
  return {
    language,
    path,
    code: code.replace(/\s+$/, ''),
    testPath: path.replace(new RegExp(`\\.${extension}$`), `.test.${extension}`),
  };
}
