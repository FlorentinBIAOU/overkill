/**
 * Essai interactif — lire les données produit d'une page marchande.
 *
 * L'extrait du niveau recommandé ne dépend de rien : il est chargé par le
 * navigateur et s'exécute à chaque frappe. Collez-y le source d'une fiche
 * produit — le bloc JSON-LD suffit — et vous verrez ce que le code en tire.
 *
 * Le tableau montre les six champs lus. Ce qui n'a pas pu être lu est vide, et
 * le prix garde son texte d'origine à côté de lui quand ce n'est pas un nombre.
 */
import { readProducts } from '../../snippets/extract-product-data-from-a-shop-page/n0.js';

const T = {
  fr: {
    colonnes: ['Produit', 'Nom', 'Référence', 'Marque', 'Prix', 'Devise', 'Disponibilité'],
    trouve: (n) => (n === 1 ? '1 produit lu' : `${n} produits lus`),
    rien: 'Aucun produit',
  },
  en: {
    colonnes: ['Product', 'Name', 'SKU', 'Brand', 'Price', 'Currency', 'Availability'],
    trouve: (n) => (n === 1 ? '1 product read' : `${n} products read`),
    rien: 'No product',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Collez le source d’une fiche produit, ou seulement son bloc JSON-LD. Rien ne part sur le réseau : le code lit le texte que vous lui donnez.',
    en: 'Paste the source of a product page, or just its JSON-LD block. Nothing goes out on the network: the code reads the text you give it.',
  },

  run(input, lang) {
    const t = T[lang];
    const rapport = readProducts(input);
    return {
      rows: {
        columns: t.colonnes,
        rows: rapport.products.map((p, i) => [
          String(i + 1),
          { v: p.name ?? '', caught: Boolean(p.name) },
          { v: p.sku ?? '', caught: Boolean(p.sku) },
          { v: p.brand ?? '', caught: Boolean(p.brand) },
          { v: p.price === null ? (p.price_text ?? '') : String(p.price), caught: p.price !== null },
          { v: p.currency ?? '', caught: Boolean(p.currency) },
          { v: p.availability ?? '', caught: Boolean(p.availability) },
        ]),
      },
      verdict: {
        label: rapport.products.length ? t.trouve(rapport.products.length) : t.rien,
        detail: rapport.reason ?? '',
      },
    };
  },

  // données-fictives:début — des pages de boutique fabriquées pour cette page,
  // prix compris : ce sont les données que l'extrait doit lire, pas un tarif
  // que le site affirme.
  cases: [
    {
      label: { fr: 'Le bloc qu’émet une boutique ordinaire', en: 'The block an ordinary shop emits' },
      input: '<script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Moulin à café Lumière","sku":"MC-4501","gtin13":"3760012345678","brand":{"@type":"Brand","name":"Lumière"},"offers":{"@type":"Offer","price":"19.90","priceCurrency":"EUR","availability":"https://schema.org/InStock"}}</script>',
    },
    {
      label: { fr: 'La page du produit, et son carrousel d’articles voisins', en: 'The product page, and its carousel of related items' },
      input: '<script type="application/ld+json">[{"@type":"Product","name":"Moulin à café Lumière","sku":"MC-4501","offers":{"@type":"Offer","price":"19.90","priceCurrency":"EUR"}},{"@type":"Product","name":"Bouilloire Lumière","sku":"MC-9000","offers":{"@type":"Offer","price":"34.00","priceCurrency":"EUR"}}]</script>',
    },
    {
      label: { fr: 'Un prix écrit à la française', en: 'A price written the French way' },
      input: '<script type="application/ld+json">{"@type":"Product","name":"Machine à pain","sku":"MP-77","offers":{"@type":"Offer","price":"1 234,56","priceCurrency":"EUR","availability":"InStock"}}</script>',
    },
    {
      label: { fr: 'Une page qui ne publie rien de structuré', en: 'A page that publishes nothing structured' },
      input: '<div class="produit"><h1>Moulin à café Lumière</h1><span class="prix">19,90 €</span><span class="ref">MC-4501</span></div>',
      fails: true,
      why: {
        fr: 'Pas de bloc JSON-LD : ce niveau ne rend rien, et il le dit au lieu de deviner. Les valeurs sont pourtant là, dans des classes CSS qui changeront à la prochaine refonte — c’est le cas où des sélecteurs, ou un appel de modèle, se justifient. La plupart des boutiques ne sont pas dans ce cas : elles publient le bloc parce que les moteurs de recherche le demandent.',
        en: 'No JSON-LD block: this level returns nothing, and says so instead of guessing. The values are there, though, in CSS classes that will change at the next redesign — that is the case where selectors, or a model call, earn their keep. Most shops are not in that case: they publish the block because search engines ask for it.',
      },
    },
  ],
  // données-fictives:fin
};
