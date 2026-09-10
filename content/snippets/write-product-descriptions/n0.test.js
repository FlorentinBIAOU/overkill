/**
 * Tests for the template renderer.
 *
 * The catalogue below is invented from end to end: no existing brand, no
 * existing product. It is varied on purpose — a missing material here, a
 * single colour there, a feminine category, an accented name — because a
 * template is only worth what it does with an incomplete record.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { describe } from './n0.js';

// Attributes a shop really stores, and one it does not: `gender` is the
// grammatical gender of the category noun, which no product database keeps and
// every French sentence needs.
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

test('renders a complete product', () => {
  assert.equal(
    describe(CATALOGUE[0]),
    'Aurore 500, un sac à dos en toile recyclée pour les randonneurs. ' +
      'Côté équipement : poche pour ordinateur et sangle ventrale. ' +
      'Existe en ardoise et sable. ' +
      'Livré avec deux ans de garantie.',
  );
});

test('agrees with a feminine category', () => {
  // « une lampe », « pensée », « Livrée » : one gender field, three
  // agreements, and not one extra template.
  const described = describe(CATALOGUE[1]);
  assert.ok(described.startsWith('Brise 12 : une lampe de bureau en aluminium brossé, pensée pour'));
  assert.ok(described.includes('Livrée avec cinq ans de garantie.'));
});

test('enumerates with commas and one conjunction', () => {
  assert.ok(describe(CATALOGUE[1]).includes('blanc, noir et laiton'));
  assert.ok(describe(CATALOGUE[1], { conjunction: 'ou' }).includes('blanc, noir ou laiton'));
});

test('agrees the number with the length of the list', () => {
  assert.ok(describe(CATALOGUE[6]).includes('Point fort : assise empilable.'));
  assert.ok(describe(CATALOGUE[8]).includes('Points forts : couture apparente et signet.'));
});

test('a single item is not enumerated', () => {
  const described = describe(CATALOGUE[2]);
  assert.ok(described.includes('À choisir en bleu nuit.'));
  assert.ok(!described.includes(' et '));
});

test('prefers the wording that uses the most attributes', () => {
  // Material and audience are both filled in, so the sentence says both,
  // rather than drawing a shorter wording that would waste them.
  const described = describe(CATALOGUE[0]);
  assert.ok(described.includes('toile recyclée') && described.includes('les randonneurs'));
});

test('skips the blocks whose attributes are missing', () => {
  // No warranty on this one, and no audience either.
  const described = describe(CATALOGUE[9]);
  assert.ok(!described.toLowerCase().includes('garantie'));
  assert.equal(
    described,
    'Jonc : un panier de rangement en rotin tressé. ' +
      'Au programme : poignées cousues. ' +
      'À choisir en blond et cendre.',
  );
});

test('falls back to the shortest wording when only the name remains', () => {
  assert.equal(describe({ name: 'Ténor', category: 'réveil', gender: 'm' }), 'Ténor : un réveil.');
});

test('ignores empty values and empty list items', () => {
  const described = describe({
    name: 'Volute',
    category: 'vase',
    gender: 'm',
    material: '   ',
    colours: ['ocre', '', '  '],
    warranty: '',
  });
  assert.equal(described, 'Volute, un vase. Disponible en ocre.');
});

test('an empty record renders nothing rather than a broken sentence', () => {
  assert.equal(describe({}), '');
});

test('the same product always gets the same description', () => {
  assert.equal(describe(CATALOGUE[4]), describe(CATALOGUE[4]));
});

const VALUE_SEQUENCE = /(?:·(?:, | et ))+·/g;

/**
 * The description with every value the product supplied blanked out.
 *
 * What is left is the frame: the words the template contributed. Two products
 * sharing a frame read as two runs of the same machine, whatever their
 * attributes. Enumerations are collapsed so that « ·, · et · » counts as the
 * same frame as « · » — the number of colours is the shop's doing, not the
 * template's.
 */
function frame(product) {
  let described = describe(product);
  const values = [];
  for (const [key, value] of Object.entries(product)) {
    if (key === 'gender') continue; // grammar, not a value the reader sees
    values.push(...(Array.isArray(value) ? value : [value]));
  }
  for (const value of values.sort((a, b) => b.length - a.length)) {
    described = described.split(value).join('·');
  }
  return described.replace(VALUE_SEQUENCE, '·');
}

/** How many times each frame comes back. */
function tally(frames) {
  const counts = new Map();
  for (const one of frames) counts.set(one, (counts.get(one) ?? 0) + 1);
  return counts;
}

test('breaking point: the catalogue is written from a handful of frames', () => {
  // The breaking point claimed on the entry: a thousand descriptions from one
  // template read like a thousand descriptions from one template.
  //
  // This is measured, not asserted. Every description of a two-hundred-entry
  // catalogue is stripped of its own values, and the frames left behind are
  // counted. The four blocks offer two, three, three and three eligible
  // wordings to a complete record, but one product draws all four from the
  // same seed: the ceiling is the least common multiple of those, six, doubled
  // by the two grammatical genders of the fixture. Twelve frames for two
  // hundred products.
  //
  // That is the honest description of this rung, and it is not a bug to fix by
  // adding wordings: a template can only ever say what somebody wrote in it,
  // and the twenty-first wording is written by a human being who has already
  // written twenty.
  const full = Array.from({ length: 200 }, (_, index) => ({
    name: `Série ${String(index).padStart(3, '0')}`,
    category: index % 2 ? 'lampe de bureau' : 'sac à dos',
    gender: index % 2 ? 'f' : 'm',
    material: index % 2 ? 'aluminium brossé' : 'toile recyclée',
    audience: index % 2 ? 'les bureaux' : 'les randonneurs',
    features: ['bras articulé', 'variateur continu'],
    colours: ['ardoise', 'sable'],
    warranty: 'deux ans',
  }));
  const frames = tally(full.map(frame));
  assert.equal(full.length, 200);
  assert.equal(frames.size, 12);
  // No frame is a rarity either: each is used by a sixteenth of the shelf or
  // more, so the repetition is visible to anyone reading two pages in a row.
  assert.ok(Math.min(...frames.values()) >= Math.floor(full.length / 16));
});

test('breaking point: it holds on records that differ in shape', () => {
  // Same measurement on the hand-written catalogue, whose records differ in
  // which attributes exist at all.
  //
  // Their first sentences fall into nine frames for twenty products, and the
  // commonest covers a quarter of them. What variety there is comes from the
  // holes in the data, not from the template: fill the catalogue in properly
  // and the count goes down, not up.
  const openings = tally(CATALOGUE.map((product) => frame(product).split('. ')[0]));
  assert.ok(openings.size <= 9 && openings.size < CATALOGUE.length);
  assert.ok(Math.max(...openings.values()) >= Math.floor(CATALOGUE.length / 4));
});
