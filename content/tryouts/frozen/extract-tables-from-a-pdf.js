/**
 * Essai figé — extraire les tableaux d'un PDF.
 *
 * Figé pour deux raisons : l'entrée est un fichier, pas du texte, et l'extrait
 * du niveau recommandé s'appuie sur `pdf.js`, un paquet installé. Les sorties
 * sont calculées à la construction du site en exécutant le vrai extrait sur
 * les cinq documents ci-dessous, fabriqués pour cette page.
 *
 * Attention à ce que l'essai montre : c'est l'extrait JavaScript qui tourne,
 * et il ne lit pas les filets. Sur le tableau tracé à cellule repliée,
 * l'extrait Python de la même fiche répond autrement, et la fiche dit
 * pourquoi.
 */
import zlib from 'node:zlib';

import { readTables } from '../../snippets/extract-tables-from-a-pdf/n0.js';

const pdf = (...morceaux) => zlib.inflateSync(Buffer.from(morceaux.join(''), 'base64'));

const DOCUMENTS = {
  TABLEAU: pdf(
    'eNptlN9u2jAUxu/zFOcGaZNoYyd2/khVpdGCKm3VGETaRbWLFBzqKthTYja2l9zFXmDabpa3mGNsMmoARYff'
    + '+ZzvOMrn0fx2doEvSTD6/efHzwADAvn4HFxdQVh8+8wgvClVWcsNhPNyw1qItGAB19cBE+teGHkLDrrwLV+3'
    + '8EB7+Sd9F7kTCvB/C+NhIYTvmNioJ0gJ6hWtali5DdAlha8BjSHNCWyBpoeqhqWBaeSgrhykyEFdORhlDurK'
    + 'QZQ4qCsHD0YDw5mDprI0xo6aylJCHDWVu2t6Mr+lkwLCGQaMoKjMM0f62dAU0kyTLbxadFXXMLFir6F4Pgpw'
    + 'Nihuu5ZvRKm4FCeaGA+aD7tSKK66EwEhg2De8D3cFSf9fgqamfb9zQWhCPszuL7c1VzAL1iVVedPYVWRb287'
    + 'OB/nyDOPE2eeI4R8c9ufyB2va8kb5jtbCfadbScmY+Q7Y+KccXTO2faLp47/bRhUUqgz5lYV++a2Q+iYHu4+'
    + 'Lfo02Nfd5oJ4gZppHwiXu0dl/vYQQzgpW3bo3LH6C1N8VUI4FSu55kKn9SMXb0TLj2AIHj2b2P6q3zhlAx7e'
    + 'szUvJ3IPD/0GaE4hI5EO8oK1ctesdML79WYAU+gt2pOh/+m862cjVAvxi/Ni37AqQJAE6PiBhNKYQgVHhvWM'
    + 'piMGlhCP4Qh7LNeJfMGw/g5MNSWvWWO2v+TfGSR6U1L2h5OdtFVlo8ycGMdJMBpN38+Cf0GVQCM='),
  SANS_FILETS: pdf(
    'eNptU9Fq2zAUffdX3JfABukk2ZITQyksbUJhK8tSwx7KHlRHTlVcacjyyPaTfdgPjO1l/ovJjhI3VYwx9j3n'
    + '6pxrzh0trxZn5B2NRn/+Pv+KCGDQ94/R+Tmg/Mc3AeiSW17pDaAl34gaYkdYwcVFJNS6I8ZBw46HPsh1DXes'
    + 'o391p+hGWSAvGpOhEdBHoTb2AVjcM2prBH+KZjmgBQGCIS97Y9gdwCYwmbrKE7xZtWVrhCrEW8gfDwQyHRhX'
    + 'bS03ilup1REnIQPnc8OVlbY9IlA6EJZGbuE6P8I7F2zawzeXZ5RhEnrY47qppILfUPCyDV14VhzKe4Rk4wwH'
    + '4km6F88wxqG4x2e6kVWlpRGhsqeQUNkjCR3jUJnQvTKJTyl7PH9o5T8joNTKnhD3rCQU9whlY7Y7fZ53kfGZ'
    + '8OGhQeoWTgfQbXNv+8+uSADNeC12yLWovgsrCw5orgq9lspF+otU71UtD4UhnexkrLunS5z1W4BuxFrymd7C'
    + 'XTcAyxhMaezSvhK1bkzh1qDr7w30L25Evz7d7ZbC/Rtla0heLdXWiDLCkEb4cEHKWMKghEONOI89ooZaSoMa'
    + 'cTv1upZmIW+SveBZw2UlTD/+rfwpIHVDad1tsHdaW25s7zMjk2g0mn9aRP8BLUIT7Q=='),
  CELLULE_REPLIEE: pdf(
    'eNptlN9q2zAUxu/9FOcmsEFaS7blP1AKS5tQWMu6xLCLsgs3VjIVWxq2vGV7yV3sBcZ2U7/FJEWKmzohhJPf'
    + '+XTyHaMvk/vrxRk+j7zJ33+/fnsYEIjHJ+/iAvz8x1cK/lUhi0pswb8vtrSFQAmWcHnpUV5qYTA6sNf571nZ'
    + 'wgPR8s9qiui4BPziYDgcBP+W8q38AjEhWtHKhha1h84JfPdICEkWQQ0k2VcVrAxMAgdV5WCQOqgqB1HsoKoc'
    + '3M8cGE4dNJWlIXbUVJZGkaOmclOTI6uWznLwFxgwgnxjHi9Sj4EkkKSK1PBm2W/6hvI1fQv500GA00Fx3bds'
    + 'ywvJBD/ShHjQfOwKLpnsjwRRNAjuG7aDm/yor12Q1LTvrs4igvDYg+uLrmIc/sC62PRw29XsuaFjN1YdjG3Y'
    + 'Ds6mGRr/Shibbi3K54pCgIJ4Cn3J9MpQsVotRkfOceScZwidmGn7M9GxqhLslF0rwWO7thNGUzt6nuuLa2+m'
    + 'vcLR6O4vhLrl/qp7lOarhhj8WdHSfeeGVt+oZOsC/Dlfi5JxFaxPjL/jLTuAISPkZLj0p7ox0mbRv6MlK2Zi'
    + 'Bw96AZIRSKNAZW5JW9E1axVGfd4YMIVa0YZYv1U0uVTTWghfRXvX0I2HIPbQ4aUTGhLYwIFh5dF0+MDiaMRw'
    + 'gEcsVRF9zbLgxTzZFKyijVl/xX5SiNVSQuj/Eeu0lUUjjU+MCPYmk/mHhfcfqPEzlA=='),
  PROSE: pdf(
    'eNptUstq20AU3c9XnI0hLXakkSXFhRCIU5tCUxpiQRehi4l07U6QZ4xmFNz+ZBf9gdJs4r/IHdm1Q10hhO65'
    + '59x37+b9dCBPU9H78/Tzl5CIYe8fxPk5ouL7ihBdKa9qu0B0oxbkkDDhFhcXgkwViMmRYMuLPurK4S4L9K8c'
    + 'xbbGQ74SDg9CRNdkFv4bkmEWGM43pJZiXCCaSsgExRzZGc5GMYoKMkdxLU6urPGN8qgIq4acV15bEyxHzaMu'
    + 'yb1B8YDirTiZMJFQKzhb6o3fYLKm5aomzC5nfagWpVppbrLzq3qv41hLXTOP2sa6PirOCDadfl4w6Dx+Y2xb'
    + 'Ho6hwV41ZokypW0b3wd1grLWxNJq4/TCbFDqgVo1z+70r2ZShKHsut6NJz2a6zSkj2btve/MAEpEY+Vo6/lA'
    + '9SN5XSpEE85facNL+6LNpXF6Dxzmn/13ceHbhGK3e44+UaXV2K5xFzOQvcswShPe5y057pCnjKDvCuh+JNLd'
    + 'gYQ3CkviaA7Df85m3dBcxMhFvH+QZxnvf449JrnGzmMOWJ4eYTKRR1gaj46wLH4Vj29H19R07c/0D0LOTVkb'
    + 'bnRXKZ9U47s686EUvd7k81S8AAGN6nc='),
  SCAN: pdf(
    'eNptUstq20AUpdDVUOg2ZBEuFJNVOnqMhEsSLxzHjXFLXLuQgMliLN3YYySNMxoXu+t+RheFfkA/oX/QGrLN'
    + 'Kt12012XnZEd21QRw8xwdM7Vueeq0mk0D9yXjFTuf/28JS44IAdjcnQE9P18gkBPuOaJHALt8CHm4BlCF2o1'
    + 'gllsiV5JsOTRtohz6AeWfmWqyGmmwd0S+hsh0DeYDfUIfMcScq2Qp+QGgldW7kCVecUZpUBbqQsNCe9smRVx'
    + 'VZCVnFyeD8YYaaC96UAXSCs15oBeiNh8jTlAz1AMRxqC0FpMpOpNeGQIDfwgInyt+BxoXei8g+pEphOZoemi'
    + 'CrQpEo3KnAnX2MBIxrhugvlbTcw+3y4Wi7/Pn+6++LT3LPuyf7xz5+x+//rncL21U//Jj2/kd7mj4NFs7a6s'
    + 'j+Uo6FuMBa/LGfRtRjYzk5eJvIu5nKrIzMLqH7Kwd5shW83RLtN6pk3FHPz/pjtTeE0cCImzfiAMAj+Aa1hj'
    + 'rvFZvMk2WMhKmOu5JcxzvBLG3C1MKy4SVEUEPfERwQyqK6X9lVZOc82VLnwGzCOVyul5k/wD2SfOiA=='),
};

const T = {
  fr: {
    lu: (n, s) => `${n} ligne(s) — lecture « ${s} »`,
    rien: 'Aucun tableau',
  },
  en: {
    lu: (n, s) => `${n} row(s) — “${s}” reading`,
    rien: 'No table',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Cinq documents fabriqués pour cette page. C’est l’extrait JavaScript qui tourne : il devine les colonnes, faute de bibliothèque qui lise les filets.',
    en: 'Five documents built for this page. It is the JavaScript snippet that runs: it guesses the columns, for want of a library that reads the rules.',
  },

  async run(input, lang, cas) {
    const t = T[lang];
    const rapport = await readTables(DOCUMENTS[cas?.document ?? 'TABLEAU']);
    const table = rapport.tables[0];
    if (!table) return { verdict: { label: t.rien, detail: rapport.reason ?? input } };
    const largeur = Math.max(...table.rows.map((r) => r.length));
    return {
      rows: {
        columns: table.rows[0].concat(Array(largeur - table.rows[0].length).fill('')),
        rows: table.rows.slice(1).map((r) => r.map((c) => ({ v: c, caught: Boolean(c) }))),
      },
      verdict: { label: t.lu(table.rows.length, table.strategy), detail: input },
    };
  },

  cases: [
    {
      label: { fr: 'Une facture dont le tableau est tracé', en: 'An invoice whose table is ruled' },
      input: { fr: 'Quatre lignes, quatre colonnes, et « Prix HT » entier.', en: 'Four rows, four columns, and “Prix HT” whole.' },
      document: 'TABLEAU',
    },
    {
      label: { fr: 'La même facture, sans un seul filet', en: 'The same invoice, without a single rule' },
      input: { fr: 'Même grille : les colonnes se devinent d’après la position des mots.', en: 'Same grid: the columns are guessed from where the words sit.' },
      document: 'SANS_FILETS',
    },
    {
      label: { fr: 'Une page de prose', en: 'A page of prose' },
      input: { fr: 'Une colonne et une ligne par ligne de texte : ce n’est pas un tableau, et rien n’est inventé.', en: 'One column and one row per line of text: this is not a table, and nothing is invented.' },
      document: 'PROSE',
    },
    {
      label: { fr: 'Une page scannée', en: 'A scanned page' },
      input: { fr: 'Aucun mot à placer : rien ne sort.', en: 'No word to place: nothing comes out.' },
      document: 'SCAN',
    },
    {
      label: { fr: 'Un tableau tracé dont une désignation tient sur deux lignes', en: 'A ruled table whose designation wraps onto two lines' },
      input: { fr: 'Quatre lignes au lieu de trois.', en: 'Four rows instead of three.' },
      document: 'CELLULE_REPLIEE',
      fails: true,
      why: {
        fr: 'La seconde ligne de la désignation devient une ligne de tableau à elle seule, vide partout ailleurs. Les filets tracés sur la page disaient pourtant que les deux lignes étaient dans la même case : l’extrait Python de cette fiche, qui les lit, rend trois lignes. Ce n’est pas un défaut de l’algorithme de repli, c’est ce qu’on perd à deviner — et c’est pour cela que le rapport dit toujours laquelle des deux lectures a répondu.',
        en: 'The second line of the designation becomes a table row of its own, empty everywhere else. The rules drawn on the page did say the two lines were in one cell: the Python snippet of this entry, which reads them, returns three rows. This is not a flaw in the fallback algorithm, it is what guessing costs — and it is why the report always says which of the two readings answered.',
      },
    },
  ],
};
