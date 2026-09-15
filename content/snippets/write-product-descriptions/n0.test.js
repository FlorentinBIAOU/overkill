/**
 * Tests du niveau N0 : gabarits à trous, accord grammatical, repli sur les
 * attributs présents. Le catalogue est inventé de bout en bout ; les valeurs
 * attendues sont celles de n0.test.py.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, describe } from './n0.js';

// Des attributs qu'une boutique stocke vraiment, et un qu'elle ne stocke pas :
// `gender` est le genre grammatical du nom de catégorie.
const CATALOGUE = [
  {
    name: 'Aurore 500',
    category: 'sac à dos',
    gender: 'm',
    material: 'toile recyclée',
    audience: 'les randonneurs',
    features: ['poche pour ordinateur', 'sangle ventrale'],
    colours: ['ardoise', 'sable'],
    warranty: 'deux ans',
  },
  {
    name: 'Brise 12',
    category: 'lampe de bureau',
    gender: 'f',
    material: 'aluminium brossé',
    audience: 'les postes en télétravail',
    features: ['bras articulé', 'variateur continu'],
    colours: ['blanc', 'noir', 'laiton'],
    warranty: 'cinq ans',
  },
  {
    name: 'Comète',
    category: 'gourde isotherme',
    gender: 'f',
    material: 'acier inoxydable',
    audience: 'les cyclistes',
    features: ['bouchon à une main'],
    colours: ['bleu nuit'],
    warranty: 'trois ans',
  },
  {
    name: 'Dune 40',
    category: 'tapis de sol',
    gender: 'm',
    material: 'liège naturel',
    features: ['surface antidérapante', 'sangle de transport'],
    colours: ['miel', 'écorce'],
    warranty: 'deux ans',
  },
  {
    name: 'Écume',
    category: 'serviette de bain',
    gender: 'f',
    material: 'coton peigné',
    audience: 'les familles',
    colours: ['ivoire', 'argile', 'océan'],
    warranty: 'un an',
  },
  {
    name: 'Fanal 3',
    category: 'lanterne de camp',
    gender: 'f',
    material: 'polycarbonate',
    audience: 'les bivouacs',
    features: ['trois intensités', 'crochet pivotant', 'recharge par câble'],
    warranty: 'deux ans',
  },
  {
    name: 'Gravier',
    category: 'chaise de jardin',
    gender: 'f',
    material: 'frêne huilé',
    audience: 'les terrasses',
    features: ['assise empilable'],
    colours: ['naturel', 'vert olive'],
    warranty: 'dix ans',
  },
  {
    name: 'Houle Mini',
    category: 'enceinte portative',
    gender: 'f',
    material: 'silicone souple',
    audience: 'les week-ends',
    features: ['dragonne', 'commande tactile'],
    colours: ['corail', 'menthe'],
    warranty: 'deux ans',
  },
  {
    name: 'Iris 2',
    category: 'carnet à points',
    gender: 'm',
    material: 'papier ivoire',
    audience: 'les carnettistes',
    features: ['couture apparente', 'signet'],
    colours: ['bordeaux'],
    warranty: 'un an',
  },
  {
    name: 'Jonc',
    category: 'panier de rangement',
    gender: 'm',
    material: 'rotin tressé',
    features: ['poignées cousues'],
    colours: ['blond', 'cendre'],
  },
  {
    name: 'Kaolin',
    category: 'tasse à café',
    gender: 'f',
    material: 'grès émaillé',
    audience: 'les petits déjeuners',
    features: ['passage au lave-vaisselle'],
    colours: ['craie', 'ardoise', 'terre'],
    warranty: 'deux ans',
  },
  {
    name: 'Lisière',
    category: 'plaid',
    gender: 'm',
    material: 'laine mêlée',
    audience: 'les canapés',
    features: ['franges nouées à la main'],
    colours: ['bruyère', 'orage'],
    warranty: 'cinq ans',
  },
  {
    name: 'Marée 20',
    category: 'sac étanche',
    gender: 'm',
    material: 'toile enduite',
    audience: 'les sorties en mer',
    features: ['fermeture à enroulement', 'bandoulière amovible'],
    colours: ['jaune vif', 'gris'],
    warranty: 'trois ans',
  },
  {
    name: 'Noria',
    category: 'arrosoir',
    gender: 'm',
    material: 'zinc',
    features: ['pomme amovible'],
    warranty: 'deux ans',
  },
  {
    name: 'Ombelle',
    category: 'housse de couette',
    gender: 'f',
    material: 'lin lavé',
    audience: 'les chambres claires',
    features: ['boutons de nacre', 'coutures renforcées'],
    colours: ['blé', 'ciel', 'argile', 'brume'],
    warranty: 'deux ans',
  },
  {
    name: 'Pivoine',
    category: 'planche à découper',
    gender: 'f',
    audience: 'les cuisines partagées',
    features: ['rainure à jus'],
    colours: ['hêtre'],
    warranty: 'un an',
  },
  {
    name: 'Quinte',
    category: 'housse de guitare',
    gender: 'f',
    material: 'feutre épais',
    features: ['poche à partitions', 'bretelles matelassées'],
    colours: ['anthracite'],
    warranty: 'deux ans',
  },
  {
    name: 'Ravin 8',
    category: 'couteau pliant',
    gender: 'm',
    material: 'acier trempé',
    audience: 'les marcheurs',
    warranty: 'dix ans',
  },
  {
    name: 'Sillage',
    category: 'trousse de toilette',
    gender: 'f',
    material: 'coton ciré',
    audience: 'les bagages à main',
    features: ['doublure lavable', 'crochet de suspension'],
    colours: ['kaki', 'sable'],
    warranty: 'deux ans',
  },
  {
    name: 'Tuile',
    category: 'dessous de plat',
    gender: 'm',
    features: ['patins de liège'],
    colours: ['terracotta', 'sable'],
  },
];

const VALUE_SEQUENCE = /(?:·(?:, | et ))+·/g;

/** La description, chaque valeur fournie par le produit effacée (existant). */
function frame(product) {
  let described = describe(product);
  const values = [];
  for (const [key, value] of Object.entries(product)) {
    if (key === 'gender') continue;
    values.push(...(Array.isArray(value) ? value : [value]));
  }
  for (const value of values.sort((a, b) => b.length - a.length)) {
    described = described.split(value).join('·');
  }
  return described.replace(VALUE_SEQUENCE, '·');
}

function tally(frames) {
  const counts = new Map();
  for (const one of frames) counts.set(one, (counts.get(one) ?? 0) + 1);
  return counts;
}

const fullCatalogue = (size = 200) =>
  Array.from({ length: size }, (_, index) => ({
    name: `Série ${String(index).padStart(3, '0')}`,
    category: index % 2 ? 'lampe de bureau' : 'sac à dos',
    gender: index % 2 ? 'f' : 'm',
    material: index % 2 ? 'aluminium brossé' : 'toile recyclée',
    audience: index % 2 ? 'les bureaux' : 'les randonneurs',
    features: ['bras articulé', 'variateur continu'],
    colours: ['ardoise', 'sable'],
    warranty: 'deux ans',
  }));

// ---------------------------------------------------------------------------
// Point de rupture
// ---------------------------------------------------------------------------

test('point de rupture : deux cents fiches complètes tiennent en douze motifs', () => {
  const full = fullCatalogue();
  const frames = tally(full.map(frame));
  assert.equal(frames.size, 12);
  assert.equal(Math.min(...frames.values()), 16);
  assert.equal(new Set(full.map((product) => describe(product))).size, 200);
});

test('point de rupture : le catalogue écrit à la main tient en neuf ouvertures', () => {
  const openings = tally(CATALOGUE.map((product) => frame(product).split('. ')[0]));
  assert.equal(CATALOGUE.length, 20);
  assert.equal(openings.size, 9);
  assert.equal(Math.max(...openings.values()), 6);
  const filled = CATALOGUE.map((p) => ({ material: 'm', audience: 'a', features: ['x', 'y'], colours: ['c', 'd'], warranty: 'w', ...p }));
  assert.equal(tally(filled.map((product) => frame(product).split('. ')[0])).size, 4);
});

// ---------------------------------------------------------------------------
// Nom, docstring, commentaires, risques
// ---------------------------------------------------------------------------

test('rend un produit complet', () => {
  assert.equal(
    describe(CATALOGUE[0]),
    'Aurore 500, un sac à dos en toile recyclée pour les randonneurs. ' +
      'Côté équipement : poche pour ordinateur et sangle ventrale. ' +
      'Existe en ardoise et sable. ' +
      'Livré avec deux ans de garantie.',
  );
});

test('accorde avec une catégorie féminine', () => {
  const described = describe(CATALOGUE[1]);
  assert.ok(described.startsWith('Brise 12 : une lampe de bureau en aluminium brossé, pensée pour'));
  assert.ok(described.includes('Livrée avec cinq ans de garantie.'));
  assert.ok(describe(CATALOGUE[4]).endsWith('Garantie un an.'));
  assert.equal(describe({ name: 'Fado', category: 'réveil', warranty: 'un an' }), 'Fado : un réveil. Garanti un an.');
});

test('le genre par défaut est le masculin', () => {
  assert.equal(describe({ name: 'Ténor', category: 'réveil' }), describe({ name: 'Ténor', category: 'réveil', gender: 'm' }));
  assert.equal(describe({ name: 'Ténor', category: 'montre', gender: 'Féminin' }), 'Ténor : une montre.');
});

test('énumère avec des virgules et une seule conjonction', () => {
  assert.ok(describe(CATALOGUE[1]).includes('blanc, noir et laiton'));
  assert.ok(describe(CATALOGUE[1], { conjunction: 'ou' }).includes('blanc, noir ou laiton'));
});

test('accorde le nombre avec la longueur de la liste', () => {
  assert.ok(describe(CATALOGUE[6]).includes('Point fort : assise empilable.'));
  assert.ok(describe(CATALOGUE[8]).includes('Points forts : couture apparente et signet.'));
});

test('un élément seul n’est pas énuméré', () => {
  const described = describe(CATALOGUE[2]);
  assert.ok(described.includes('À choisir en bleu nuit.'));
  assert.ok(!described.includes(' et '));
});

test('préfère la formulation qui emploie le plus d’attributs', () => {
  const described = describe(CATALOGUE[0]);
  assert.ok(described.includes('toile recyclée') && described.includes('les randonneurs'));
});

test('saute les blocs dont les attributs manquent', () => {
  const described = describe(CATALOGUE[9]);
  assert.ok(!described.toLowerCase().includes('garantie'));
  assert.equal(described, 'Jonc : un panier de rangement en rotin tressé. Au programme : poignées cousues. À choisir en blond et cendre.');
});

test('se replie sur la formulation la plus courte quand il ne reste que le nom', () => {
  assert.equal(describe({ name: 'Ténor', category: 'réveil', gender: 'm' }), 'Ténor : un réveil.');
});

test('ignore les valeurs vides et les éléments vides', () => {
  assert.equal(
    describe({ name: 'Volute', category: 'vase', gender: 'm', material: '   ', colours: ['ocre', '', '  '], warranty: '' }),
    'Volute, un vase. Disponible en ocre.',
  );
});

test('une fiche vide ne rend rien plutôt qu’une phrase cassée', () => {
  assert.equal(describe({}), '');
});

test('le même produit reçoit toujours la même description', () => {
  const reversed = Object.fromEntries(Object.entries(CATALOGUE[4]).reverse());
  for (let i = 0; i < 5; i += 1) assert.equal(describe(CATALOGUE[4]), describe(reversed));
});

test('chaque phrase est une formulation écrite d’avance', () => {
  const escape = (text) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patterns = BLOCKS.flat().map((wording) => {
    const source = wording
      .split(/(\{\w+\})/)
      .map((part) => {
        if (part === '{un}') return '(?:un|une)';
        if (part === '{e}' || part === '{s}') return `${part[1]}?`;
        if (part.startsWith('{')) return '(.+?)';
        return escape(part);
      })
      .join('');
    return new RegExp(`^${source}$`);
  });
  for (const product of CATALOGUE) {
    const values = new Set(Object.values(product).flat().map(String));
    for (const sentence of describe(product).split(/(?<=\.) (?=[A-ZÀ-ÖØ-Þ])/)) {
      const match = patterns.map((p) => sentence.match(p)).find(Boolean);
      assert.ok(match, sentence);
      for (const filled of match.slice(1)) {
        assert.ok(filled.split(/, | et /).every((piece) => values.has(piece)), filled);
      }
    }
  }
});

test('les marques de grammaire ne sont pas remplacées par un attribut du même nom', () => {
  assert.equal(describe({ name: 'X', category: 'sac', e: 'ZZ', s: 'YY', un: 'QQ', features: ['a', 'b'] }), 'X : un sac. Au programme : a et b.');
});

test('le tirage donne le même texte qu’en Python', () => {
  const zoe = { name: 'Zoé', category: 'sac', material: 'cuir', audience: 'tous', features: ['x'], colours: ['r', 'v'], warranty: 'deux ans' };
  assert.equal(
    describe({ name: 'Brise 🙂', category: 'lampe', gender: 'f', material: 'verre', features: ['a', 'b'], colours: ['c'], warranty: 'un an' }),
    'Brise 🙂, une lampe en verre. Points forts : a et b. Disponible en c. Garantie un an.',
  );
  assert.equal(describe(zoe), 'Zoé : un sac en cuir, pensé pour tous. Côté équipement : x. Existe en r et v. Livré avec deux ans de garantie.');
  assert.ok(describe({ ...zoe, name: 'Zoé'.normalize('NFD') }).endsWith('Garanti deux ans.'));
});

test('INFIRMÉ : « le vingt-et-unième gabarit s’écrit à la main par quelqu’un qui en a déjà écrit vingt » ; seize formulations', () => {
  assert.equal(BLOCKS.flat().length, 16);
  assert.throws(() => assert.equal(BLOCKS.flat().length, 20), assert.AssertionError);
});

test('une description se rend en moins d’une milliseconde', () => {
  let best = Infinity;
  for (let i = 0; i < 50; i += 1) {
    const start = performance.now();
    describe(CATALOGUE[1]);
    best = Math.min(best, performance.now() - start);
  }
  assert.ok(best < 1);
});

// ---------------------------------------------------------------------------
// Cas de production
// ---------------------------------------------------------------------------

test('production : dix mille fiches terminent vite', () => {
  const catalogue = fullCatalogue(10_000);
  const start = performance.now();
  assert.equal(catalogue.map((product) => describe(product)).length, 10_000);
  assert.ok(performance.now() - start < 5000);
});

test('production : encodage NFD, emoji, insécables et listes limites', () => {
  const name = 'Écume'.normalize('NFD');
  assert.equal(describe({ name, category: 'serviette', gender: 'f', colours: ['ivoire\u00a0clair'] }), `${name} : une serviette. À choisir en ivoire\u00a0clair.`);
  assert.equal(describe({ name: 'X', category: 'sac', colours: [] }), 'X : un sac.');
  assert.equal(describe({ name: 'X', category: 'sac', colours: Array(1000).fill('un') }).split(', ').length - 1, 998);
});

test('production : sans nom, la phrase d’identité disparaît', () => {
  assert.equal(describe({ category: 'sac à dos', material: 'toile', features: ['a'] }), 'Point fort : a.');
});

test('DÉFAUT : un attribut nul est écrit « null » dans la description', () => {
  const described = describe({ name: 'X', category: 'sac', material: null, warranty: null });
  assert.throws(() => assert.ok(!described.includes('null')), assert.AssertionError);
});
