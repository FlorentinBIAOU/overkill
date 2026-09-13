/**
 * Lecture d'un cas d'essai, côté site comme côté navigateur.
 *
 * Un cas porte une saisie et des textes qui peuvent être bilingues : une
 * chaîne quand l'exemple est le même dans les deux langues — un numéro de
 * téléphone, un CSV — un couple `{ fr, en }` quand il doit être traduit.
 */

/** Une valeur bilingue, dans la langue demandée. */
export function bilingual(value, lang) {
  if (value === undefined || value === null) return undefined;
  return typeof value === 'string' ? value : value[lang];
}

/** La saisie d'un cas, dans la langue de la page. */
export function caseInput(cas, lang) {
  return bilingual(cas.input, lang);
}
