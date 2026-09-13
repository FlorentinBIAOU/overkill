/**
 * Le thème de coloration syntaxique, et les couleurs qu'on lui substitue.
 *
 * Ce module est la source unique de ces deux valeurs : le composant qui rend
 * les blocs de code les emploie, et scripts/check-contrast.mjs les relit pour
 * vérifier chaque couleur du thème contre le fond sombre des blocs. Un thème
 * changé ici est donc immédiatement remesuré.
 *
 * Thème à contraste renforcé, et non le thème sombre par défaut : l'audit
 * d'accessibilité a montré que la couleur des commentaires de « github-dark »
 * passe sous le seuil AA. Le code est le contenu le plus important du site, il
 * ne peut pas être le moins lisible.
 */

export const CODE_THEME = 'github-dark-high-contrast';

/**
 * Le fond des blocs, recopié de --code-surface pour que le contrôle de
 * contraste ait une valeur à mesurer. Les deux doivent rester identiques ;
 * scripts/check-contrast.mjs échoue si tokens.css dit autre chose.
 */
export const CODE_SURFACE = '#17140F';

/**
 * Substitutions de couleur, s'il en faut. Le contrôle de contraste colorise
 * les 149 extraits du dépôt, relève chaque couleur réellement posée et la
 * mesure contre CODE_SURFACE : avec ce thème, les neuf couleurs émises sont
 * toutes au-dessus de 4,5:1, la plus faible à 6,76:1 sur les commentaires.
 * La table reste ici parce qu'un changement de thème peut la rendre
 * nécessaire ; Shiki écrit ses couleurs en majuscules.
 */
export const CODE_SUBSTITUTIONS = {};

/** Applique les substitutions à du HTML déjà colorisé. */
export function substitute(html) {
  return Object.entries(CODE_SUBSTITUTIONS).reduce(
    (out, [from, to]) => out.replaceAll(from, to),
    html,
  );
}
