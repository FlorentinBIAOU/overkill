/**
 * Enveloppe chaque tableau du Markdown dans un conteneur qui défile.
 *
 * Un tableau de quatre colonnes ne tient pas dans 360 px, et c'est la page
 * entière qui se mettait à défiler horizontalement — ce que `check-overflow`
 * refuse à juste titre. Le contenu large défile dans son propre conteneur,
 * jamais la page (CDC 8.5, et la règle posée dans layout.css).
 *
 * Écrit à la main plutôt qu'avec `unist-util-visit` : une dépendance de plus
 * pour un parcours d'arbre de quinze lignes ne se justifie pas.
 */
export default function rehypeTableScroll() {
  return (tree) => envelopper(tree);
}

function envelopper(noeud) {
  if (!noeud || !Array.isArray(noeud.children)) return;
  for (const [i, enfant] of noeud.children.entries()) {
    if (enfant.type === 'element' && enfant.tagName === 'table') {
      noeud.children[i] = {
        type: 'element',
        tagName: 'div',
        properties: { className: ['scroll-x', 'table-scroll'] },
        children: [enfant],
      };
    } else {
      envelopper(enfant);
    }
  }
}
