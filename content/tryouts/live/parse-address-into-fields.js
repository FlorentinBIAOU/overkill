/**
 * Essai interactif — découper une adresse en champs.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus. Rien n'est
 * entraîné, rien n'est chargé : deux dictionnaires et une ancre sur le code
 * postal.
 *
 * Une adresse postale française ne se traduit pas : les exemples sont donc les
 * mêmes dans les deux langues, et seuls les noms de champs changent.
 *
 * Aucune de ces adresses n'est le domicile de quelqu'un ni le siège d'une
 * société : elles sont inventées, comme celles des tests.
 */
import { parse } from '../../snippets/parse-address-into-fields/n0.js';

/* Le type de voie ouvre déjà la voie dans la sortie de l'extrait : l'afficher
   sur sa propre ligne le répéterait sans rien apprendre. */
const CHAMPS = [
  ['number', { fr: 'Numéro', en: 'Number' }],
  ['street', { fr: 'Voie', en: 'Street' }],
  ['complement', { fr: 'Complément', en: 'Complement' }],
  ['postcode', { fr: 'Code postal', en: 'Postcode' }],
  ['city', { fr: 'Ville', en: 'Town' }],
];

const T = {
  fr: {
    colonnes: ['Champ', 'Ce que l’extrait y met'],
    vide: '— rien',
    note: 'Découpage seul : rien ici ne vérifie que l’adresse existe.',
  },
  en: {
    colonnes: ['Field', 'What the snippet puts there'],
    vide: '— nothing',
    note: 'Splitting only: nothing here checks that the address exists.',
  },
};

const MOTS = /[^\s]+/g;

/**
 * Où se trouve, dans l'adresse tapée, ce que l'extrait a rangé dans un champ.
 *
 * L'extrait rend les mots d'un champ recollés par un espace, et il réécrit
 * l'abréviation du type de voie : « bd » devient « boulevard », qui ne figure
 * pas dans le texte tapé. La valeur est donc cherchée telle quelle d'abord,
 * puis, à défaut, mot par mot du premier au dernier. Quand un mot ne se
 * retrouve pas, rien n'est surligné : on ne surligne jamais à peu près.
 */
function situer(texte, valeur) {
  if (!valeur) return null;
  const direct = texte.indexOf(valeur);
  if (direct !== -1) return { start: direct, end: direct + valeur.length };

  let curseur = 0;
  let debut = -1;
  let fin = -1;
  for (const mot of valeur.match(MOTS) ?? []) {
    const place = texte.indexOf(mot, curseur);
    if (place === -1) return null;
    if (debut === -1) debut = place;
    fin = place + mot.length;
    curseur = fin;
  }
  return debut === -1 ? null : { start: debut, end: fin };
}

export default {
  level: 'N0',

  note: {
    fr: 'Le découpage se fait dans votre navigateur, sans modèle ni appel : le code postal coupe la ligne, un dictionnaire de types de voie et un dictionnaire de compléments font le reste. Aucune adresse ne part ailleurs.',
    en: 'The split happens in your browser, with no model and no call: the postcode cuts the line, a dictionary of street types and a dictionary of complements do the rest. No address leaves the page.',
  },

  run(adresse, lang) {
    const t = T[lang];
    const champs = parse(adresse);

    /* Chaque morceau rangé dans un champ est surligné là où il se trouve dans
       l'adresse, et porte le nom du champ : on lit le découpage sur l'adresse
       elle-même, sans faire l'aller-retour avec le tableau. */
    const spans = [];
    for (const [cle, intitule] of CHAMPS) {
      const ou = situer(adresse, champs[cle]);
      if (ou) spans.push({ ...ou, label: intitule[lang] });
    }

    return {
      spans,
      rows: {
        columns: t.colonnes,
        rows: CHAMPS.map(([cle, intitule]) => [
          intitule[lang],
          champs[cle] ? { v: champs[cle], caught: true } : t.vide,
        ]),
      },
      note: t.note,
    };
  },

  cases: [
    {
      label: {
        fr: 'Une rue au nom d’une personne, une ville à trait d’union',
        en: 'A street named after a person, a hyphenated town',
      },
      input: '15 rue Victor Hugo 92100 Boulogne-Billancourt',
    },
    {
      label: { fr: 'Deux compléments placés devant la voie', en: 'Two complements put before the street' },
      input: 'Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris',
    },
    {
      label: { fr: 'Le bon code postal, la mauvaise ville', en: 'The right postcode, the wrong town' },
      input: '8 rue des Lilas, 75011 Lyon',
      fails: true,
      why: {
        fr: 'Les cinq champs ressortent propres, et l’adresse n’existe pas : 75011 est un code postal parisien. Découper n’est pas vérifier, et rien dans cette sortie ne distingue une adresse livrable d’une adresse impossible. C’est le géocodeur national qui répond à cette question-là, en une requête, et c’est une étape de plus.',
        en: 'All five fields come back clean, and the address does not exist: 75011 is a Paris postcode. Splitting is not checking, and nothing in this output tells a deliverable address from an impossible one. The national geocoder is what answers that question, in one request, and it is a further step.',
      },
    },
    {
      label: { fr: 'Une adresse allemande', en: 'A German address' },
      input: 'Hauptstrasse 5, 10115 Berlin',
      fails: true,
      why: {
        fr: 'Le numéro allemand s’écrit derrière le nom de la rue, et l’extrait attend l’inverse : le 5 reste dans la voie, le numéro ressort vide. L’ancre du code postal, elle, tient par accident — cinq chiffres aussi en Allemagne. Sur « 42 Rowan Street, Bristol BS1 4TQ », il n’y a plus d’ancre du tout, et ni code postal ni ville ne ressortent.',
        en: 'A German house number is written after the street name, and the snippet expects the opposite: the 5 stays inside the street and the number comes back empty. The postcode anchor holds by accident — five digits in Germany too. On “42 Rowan Street, Bristol BS1 4TQ” there is no anchor left at all, and neither postcode nor town comes out.',
      },
    },
  ],
};
