/**
 * Essai interactif — une image de remplacement sans modèle.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : le SVG affiché est
 * la chaîne qu'il renvoie, posée dans la page sans retouche.
 *
 * Le verdict donne la teinte en degrés, parce que c'est le seul chiffre qui
 * décide de l'image — et c'est le hachage de l'identifiant qui le produit, pas
 * ce que l'identifiant veut dire. Nommer la couleur obtenue est ce qui rend la
 * démonstration lisible sans compter les carrés : un canapé rouge qui ressort
 * en vert se voit.
 */
import { placeholderSvg, stableHash } from '../../snippets/generate-placeholder-images/n0.js';

const TAILLE = 240;

/* La roue des teintes, découpée en familles nommées. Les bornes sont celles
   qu'un œil emploie, pas celles d'une norme. */
const FAMILLES = [
  [15, { fr: 'rouge', en: 'red' }],
  [40, { fr: 'orange', en: 'orange' }],
  [70, { fr: 'jaune', en: 'yellow' }],
  [160, { fr: 'vert', en: 'green' }],
  [200, { fr: 'turquoise', en: 'teal' }],
  [255, { fr: 'bleu', en: 'blue' }],
  [290, { fr: 'violet', en: 'violet' }],
  [330, { fr: 'magenta', en: 'magenta' }],
  [360, { fr: 'rouge', en: 'red' }],
];

const T = {
  fr: {
    label: (famille, teinte) => `Teinte ${teinte}° — ${famille}`,
    detail: (carres, couleurs) =>
      `${carres} rectangles pleins en ${couleurs} couleurs, et rien à télécharger : le balisage entier tient dans la page.`,
    alt: (identifiant) => `Image de remplacement pour « ${identifiant} »`,
    stable: (identifiant) =>
      `« ${identifiant} » donnera cette image-là, en JavaScript comme en Python, tant que ce code ne change pas.`,
  },
  en: {
    label: (famille, teinte) => `Hue ${teinte}° — ${famille}`,
    detail: (carres, couleurs) =>
      `${carres} flat rectangles in ${couleurs} colours, and nothing to download: the whole markup sits in the page.`,
    alt: (identifiant) => `Placeholder image for “${identifiant}”`,
    stable: (identifiant) =>
      `“${identifiant}” will give this same image, in JavaScript as in Python, for as long as this code is left unchanged.`,
  },
};

export default {
  level: 'N0',

  note: {
    fr: 'Tapez un identifiant : une référence produit, une adresse, un nom de client. La même chaîne donne toujours exactement la même image.',
    en: 'Type an identifier: a product reference, an address, a customer name. The same string always gives exactly the same image.',
  },

  run(identifiant, lang) {
    const t = T[lang];
    const svg = placeholderSvg(identifiant, TAILLE);
    const teinte = (stableHash(identifiant) >>> 16) % 360;
    const famille = FAMILLES.find(([borne]) => teinte < borne)[1][lang];

    // Comptés dans le balisage produit, pas décrits : deux couleurs et des
    // carrés, c'est tout ce que ce barreau sait faire.
    const carres = svg.split('<rect').length - 1;
    const couleurs = new Set(
      svg.split('fill="').slice(1).map((part) => part.split('"')[0]),
    ).size;

    return {
      image: { svg, alt: t.alt(identifiant) },
      verdict: { label: t.label(famille, teinte), detail: t.detail(carres, couleurs) },
      note: t.stable(identifiant),
    };
  },

  cases: [
    {
      label: {
        fr: 'Un logo qui manque dans un annuaire',
        en: 'A logo missing from a directory',
      },
      input: 'Boulangerie Martin',
    },
    {
      label: {
        fr: 'La vue de face d’un canapé au catalogue',
        en: 'The front view of a sofa in a catalogue',
      },
      input: 'canape-4501-vue-face',
    },
    {
      label: {
        fr: 'La vue de profil du même canapé',
        en: 'The side view of the same sofa',
      },
      input: 'canape-4501-vue-profil',
    },
    {
      label: {
        fr: 'Un identifiant qui dit de quelle couleur est l’objet',
        en: 'An identifier that says what colour the thing is',
      },
      input: 'canapé en velours rouge',
      fails: true,
      why: {
        fr: 'Le mot « rouge » est dans l’identifiant et l’image sort en vert : le hachage décide de tout, le sens de l’identifiant de rien. Les deux cas précédents disent la même chose autrement — un bleu et un vert pour deux vues du même canapé. Et quel que soit l’objet, la sortie reste des rectangles pleins en deux couleurs.',
        en: 'The word “rouge” — red — is in the identifier and the image comes out green: the hash decides everything, the meaning of the identifier decides nothing. The two cases above say the same thing another way: a blue and a green for two views of one sofa. And whatever the object, the output stays flat rectangles in two colours.',
      },
    },
  ],
};
