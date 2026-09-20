/**
 * Essai figé — convertir un PDF en texte brut.
 *
 * Figé parce que l'entrée est un fichier, pas du texte, et que l'extrait du
 * niveau recommandé s'appuie sur `pdf.js`, un paquet installé. Les sorties
 * sont calculées à la construction du site en exécutant le vrai extrait sur
 * les cinq documents ci-dessous, fabriqués pour cette page.
 */
import zlib from 'node:zlib';

import { readText } from '../../snippets/convert-a-pdf-to-plain-text/n0.js';

const pdf = (...morceaux) => zlib.inflateSync(Buffer.from(morceaux.join(''), 'base64'));

const DOCUMENTS = {
  COLONNES: pdf(
    'eNptU8tq20AU3esr7sbQQmpp9LIMIVCnNoU6NCSCLkIXY+nKnSDNuDOjkPYns+gPlHblfEXvyIrcVhZCjI7O'
    + 'uc+jyfW71Rs2jb3Jr99PPzwGAajNvXd+Dn7+bYfgX3LLa7UF/5pv0UBIhBu4uPBQlo4YjgQHnv9BlAbuEkf/'
    + 'TFFUKy2wv4TRUQj+GuXWfoGYzRzDWI288RY5+CsGLIC86goLKEAyg1lGSAOv1hw2qq253KIWCFdcWyGherb4'
    + 'GvL7QRGFwSC5rPcNSqINdA4ad1qYfyQuSZp2CkO9FCQBLt3BWqST3OMU1ifS9KIaoVBNg7pAQAlhwObE56Mc'
    + 'SdjRK9Vq+EnNCHMGRc2N2Z+BJVCeSPGi4dp18SBcbWULzXOD0NA4hBylibJOgrJQGl1gAzW11XAagJmOU/T8'
    + 'EnetMPC15bQP2O7lXpNCvUiWuVtlv6t+qfHIDStF9fm37cZ2rw5k4C+4wcOX91g/oBUFB39J9ZVCktU+CflW'
    + 'GjEAR9ckJ+3mntoN4uBO/wpLwRfqEe5cV8k8gSwOyYU3aGiqBfXu9F0B3YFB3Nva3WRWaSmageg/sz9qrLwA'
    + 'Ui8YLkiTJEqgggFjVGP3RR6xNB5hLGQjLJkHIyzNZkfMai5q1F37t+I7QkpNKeX+rL5SY8nXXZ0Zi7zJZPlx'
    + '5f0BAqUUkw=='),
  PROSE: pdf(
    'eNptUstq20AU3c9XnI0hLXakkSXFhRCIU5tCUxpiQRehi4l07U6QZ4xmFNz+ZBf9gdJs4r/IHdm1Q10hhO65'
    + '59x37+b9dCBPU9H78/Tzl5CIYe8fxPk5ouL7ihBdKa9qu0B0oxbkkDDhFhcXgkwViMmRYMuLPurK4S4L9K8c'
    + 'xbbGQ74SDg9CRNdkFv4bkmEWGM43pJZiXCCaSsgExRzZGc5GMYoKMkdxLU6urPGN8qgIq4acV15bEyxHzaMu'
    + 'yb1B8YDirTiZMJFQKzhb6o3fYLKm5aomzC5nfagWpVppbrLzq3qv41hLXTOP2sa6PirOCDadfl4w6Dx+Y2xb'
    + 'Ho6hwV41ZokypW0b3wd1grLWxNJq4/TCbFDqgVo1z+70r2ZShKHsut6NJz2a6zSkj2btve/MAEpEY+Vo6/lA'
    + '9SN5XSpEE85facNL+6LNpXF6Dxzmn/13ceHbhGK3e44+UaXV2K5xFzOQvcswShPe5y057pCnjKDvCuh+JNLd'
    + 'gYQ3CkviaA7Df85m3dBcxMhFvH+QZxnvf449JrnGzmMOWJ4eYTKRR1gaj46wLH4Vj29H19R07c/0D0LOTVkb'
    + 'bnRXKZ9U47s686EUvd7k81S8AAGN6nc='),
  CESURE: pdf(
    'eNptUs1u1DAYvPsp5rJSQW0d529bqapEYFdIbEXVRuJQcfBuvg2ugr3YTlX6khx4AQSnfQucNGwQIYoiZ775'
    + '7PlmPLt+szwRpymb/fz17TsTiGDW9+ziArz8uiPw19LLxtTg17ImhzgQbnB5yUhXHTGeNDzz+DtVOdxlHf1j'
    + '2MW02kP81ZiMjeAr0rX/BDGPOobzluRnVpTgSwERo9wim2N+FqGsIHKUK3a0klibtpG6JqsIV9J6pY+htAt6'
    + 'mz3hB4pQN7Wmkxco71G+ZEeFakLHxrTWH0PiocVOOkcWX1oZDkW913srR75XRjtUhE2jSPtuuWuVgziP89M/'
    + 'rEXZzTSIHqZLJ7YsTTCA37Zr3/92oAAvpKPnyltqHsirjQRfBIWV0sHzD0q/0k4dgNG+7L++d18bhA4x8Suq'
    + 'lCzMI+6iAGTnGc7SOMRxQy54sAk5df29gH4hkA75dm9ITft+7OSf1B8tbVmEnEWHB3mWJRm2OGAiaOwresTy'
    + 'dIKJWEywJE0mWJpGI+atVA3Zfvxb9UTIw1DGdFdsUBqugfW9zizP2Wy2eL9kvwFnBNKk'),
  SCAN: pdf(
    'eNptUstq20AUpdDVUOg2ZBEuFJNVOnqMhEsSLxzHjXFLXLuQgMliLN3YYySNMxoXu+t+RheFfkA/oX/QGrLN'
    + 'Kt12012XnZEd21QRw8xwdM7Vueeq0mk0D9yXjFTuf/28JS44IAdjcnQE9P18gkBPuOaJHALt8CHm4BlCF2o1'
    + 'gllsiV5JsOTRtohz6AeWfmWqyGmmwd0S+hsh0DeYDfUIfMcScq2Qp+QGgldW7kCVecUZpUBbqQsNCe9smRVx'
    + 'VZCVnFyeD8YYaaC96UAXSCs15oBeiNh8jTlAz1AMRxqC0FpMpOpNeGQIDfwgInyt+BxoXei8g+pEphOZoemi'
    + 'CrQpEo3KnAnX2MBIxrhugvlbTcw+3y4Wi7/Pn+6++LT3LPuyf7xz5+x+//rncL21U//Jj2/kd7mj4NFs7a6s'
    + 'j+Uo6FuMBa/LGfRtRjYzk5eJvIu5nKrIzMLqH7Kwd5shW83RLtN6pk3FHPz/pjtTeE0cCImzfiAMAj+Aa1hj'
    + 'rvFZvMk2WMhKmOu5JcxzvBLG3C1MKy4SVEUEPfERwQyqK6X9lVZOc82VLnwGzCOVyul5k/wD2SfOiA=='),
  DEUX_PAGES: pdf(
    'eNq1U8tq20AU3esr7saQFifSyJZsQQjEqU2hDg2xoYvQxUS6didIM+7MKKT9yS76A6XdRPmK3hk7cht5G2PE'
    + 'zNU593WOelfvZsfsZBj0fv/58TNgEIG6vQtOTyFcftsghBfc8lKtIbziazQQE+Aazs4ClIUDxh3CFhd+EIWB'
    + 'm8TDx+75mXKpWlpKsacP9nQI5yjX9gsM2cghjNXIq2CyhHDGgEWwXPn2ImCQjGA0pkgFR3MOt6ouuVyjFgiX'
    + 'XFshYfVk8Q0s71rGII5aykXZVCgJ1sI5aNxoYf6juCJp6hmGJsqJAly6g7VIJ9ngCcwPlNmRSoRcVRXqHAEl'
    + 'xBHLCM87NZLYw1eq1vCLhhGmD3nJjWn6YCkoD5R45nDtprgXrreihuqpQqhoHUJ2ygzGnoIyVxpdYgMljVVx'
    + 'WoA56ZbY4Qvc1MLA15qTHrBuZKOJoZ4p06WTcqfVTtRhxxMzRf2Fi/rW+qsLMggn3OD2zXss79GKnEM4pf4K'
    + 'Iclwn4Q8l0a0gb1rkoOmc0+N3mDOdOElFoJP1APcuKmSLIHxMCYXXqOhreY0u+P7BvyBwXBnbvcns0pL2QwM'
    + 'Xlg+PeDZeJAc8CyJtGq9WgAjX8yDI5eYdggFwkajsX6d7mZQ3wvqyy0Wlm+Do6l0Oy85GJWLxjYwfcBqQ75a'
    + 'nC/6wGvI+UbQ5+nf87LlUa5KlITDWityU+FmpKsRj7QmKkk+m5BL1FriccuaEIXTsmtt+4CekJdbZzVGrGUD'
    + 'uTjmG/24ld5xDqk/em31x6+k/uig+ukL9R80roIIsiBqf5AmCem/gjbGyKH+jdzH0mEnxuJRJ5ZkaSeWZoNO'
    + 'bMyylzHGog6XxdE/XPKdKFH71S3Ed4SMFqKUBfY8JdlRWz8jG8RZ0OtNP86Cvy1BwMQ='),
};

const T = {
  fr: {
    lu: (n, c) => `${n} page(s), ${c} colonne(s) sur la première`,
    rien: 'Rien à lire',
  },
  en: {
    lu: (n, c) => `${n} page(s), ${c} column(s) on the first`,
    rien: 'Nothing to read',
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Cinq documents fabriqués pour cette page. Les sorties sont celles de l’extrait, exécutées à la construction du site : aucun texte n’est écrit à la main.',
    en: 'Five documents built for this page. The outputs are the snippet’s own, run when the site is built: no text is written by hand.',
  },

  async run(input, lang, cas) {
    const t = T[lang];
    const rapport = await readText(DOCUMENTS[cas?.document ?? 'PROSE']);
    if (rapport.pages.length === 0) {
      return { verdict: { label: t.rien, detail: rapport.reason ?? input } };
    }
    return {
      output: rapport.pages.map((p) => p.text).join('\n\n— — —\n\n') || '(vide)',
      verdict: {
        label: t.lu(rapport.pages.length, rapport.pages[0].columns),
        detail: input,
      },
    };
  },

  cases: [
    {
      label: { fr: 'Un contrat d’une page, une colonne', en: 'A one-page contract, single column' },
      input: { fr: 'Le texte sort dans l’ordre où il se lit.', en: 'The text comes out in the order it reads.' },
      document: 'PROSE',
    },
    {
      label: { fr: 'Une lettre d’information sur deux colonnes', en: 'A newsletter in two columns' },
      input: { fr: 'Les gouttières séparent les colonnes, et chacune est lue entièrement avant la suivante.', en: 'The gutters separate the columns, and each is read whole before the next.' },
      document: 'COLONNES',
    },
    {
      label: { fr: 'Deux pages de mises en page différentes', en: 'Two pages with different layouts' },
      input: { fr: 'Le nombre de colonnes est rendu page par page.', en: 'The number of columns is reported page by page.' },
      document: 'DEUX_PAGES',
    },
    {
      label: { fr: 'Une page scannée', en: 'A scanned page' },
      input: { fr: 'Aucun caractère à lire : zéro colonne, texte vide, et rien d’inventé.', en: 'No character to read: zero columns, empty text, and nothing invented.' },
      document: 'SCAN',
    },
    {
      label: { fr: 'Un texte justifié avec ses césures', en: 'Justified text with its hyphenation' },
      input: { fr: 'Deux mots coupés en fin de ligne.', en: 'Two words cut at the end of a line.' },
      document: 'CESURE',
      fails: true,
      why: {
        fr: '« quatre généra- » et « tions de clients » restent deux morceaux : le texte extrait est le texte imprimé, pas le texte écrit. Les recoller tient en une ligne de code, et cette ligne ferait aussi de « Boulogne- » et « Billancourt » un seul mot — qui est une autre ville. L’extrait ne devine pas ; c’est à l’appelant, qui connaît son corpus, de décider.',
        en: '“quatre généra-” and “tions de clients” stay two pieces: the extracted text is the printed text, not the written one. Gluing them back is one line of code, and that line would also glue “Boulogne-” and “Billancourt”, which is a different town. The snippet does not guess; that is for the caller, who knows their corpus.',
      },
    },
  ],
};
