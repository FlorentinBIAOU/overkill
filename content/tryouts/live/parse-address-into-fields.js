/**
 * Essai interactif — découper une adresse en champs.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * Une adresse postale française ne se traduit pas : les exemples sont donc les
 * mêmes dans les deux langues, et seuls les noms de champs changent. Un seul
 * modèle, entraîné une fois au chargement de la page sur dix-huit adresses
 * étiquetées mot par mot — la forme que prend le travail de ce barreau, et son
 * coût réel. Compter environ 120 millisecondes.
 *
 * Aucune de ces adresses n'est le domicile de quelqu'un ni le siège d'une
 * société : elles sont inventées, comme celles des tests.
 */
import { parse, tokenise, train } from '../../snippets/parse-address-into-fields/n1.js';

/* Étiqueté par segments et non par mot : c'est la forme qu'un humain peut
   relire, et l'erreur d'alignement est ce qui fait rater ce barreau. */
const ETIQUETEES = [
  [['8', 'number'], ['rue', 'street_type'], ['des Lilas', 'street'], ['75011', 'postcode'], ['Paris', 'city']],
  [['14', 'number'], ['avenue', 'street_type'], ['des Cerisiers', 'street'], ['69003', 'postcode'], ['Lyon', 'city']],
  [['3', 'number'], ['allée', 'street_type'], ['du Château', 'street'], ['33000', 'postcode'], ['Bordeaux', 'city']],
  [['27', 'number'], ['boulevard', 'street_type'], ['des Acacias', 'street'], ['13006', 'postcode'], ['Marseille', 'city']],
  [['5', 'number'], ['impasse', 'street_type'], ['des Peupliers', 'street'], ['44000', 'postcode'], ['Nantes', 'city']],
  [['2', 'number'], ['place', 'street_type'], ['des Tilleuls', 'street'], ['31000', 'postcode'], ['Toulouse', 'city']],
  [['41', 'number'], ['chemin', 'street_type'], ['des Vignes', 'street'], ['38000', 'postcode'], ['Grenoble', 'city']],
  [['9', 'number'], ['route', 'street_type'], ['de la Forêt', 'street'], ['35000', 'postcode'], ['Rennes', 'city']],
  [['12 bis', 'number'], ['rue', 'street_type'], ['des Écoles', 'street'], ['59000', 'postcode'], ['Lille', 'city']],
  [['6', 'number'], ['quai', 'street_type'], ['des Ormes', 'street'], ['67000', 'postcode'], ['Strasbourg', 'city']],
  [['8', 'number'], ['rue', 'street_type'], ['des Lilas', 'street'], ['Bâtiment C', 'complement'], ['75011', 'postcode'], ['Paris', 'city']],
  [['14', 'number'], ['avenue', 'street_type'], ['des Cerisiers', 'street'], ['Appartement 12', 'complement'], ['69003', 'postcode'], ['Lyon', 'city']],
  [['Appartement 4', 'complement'], ['3', 'number'], ['allée', 'street_type'], ['du Château', 'street'], ['33000', 'postcode'], ['Bordeaux', 'city']],
  [['Bâtiment B', 'complement'], ['Escalier 2', 'complement'], ['27', 'number'], ['boulevard', 'street_type'], ['des Acacias', 'street'], ['13006', 'postcode'], ['Marseille', 'city']],
  [['5', 'number'], ['impasse', 'street_type'], ['des Peupliers', 'street'], ['Résidence Les Ormes', 'complement'], ['44000', 'postcode'], ['Nantes', 'city']],
  [['2', 'number'], ['place', 'street_type'], ['des Tilleuls', 'street'], ['Escalier A', 'complement'], ['31000', 'postcode'], ['Toulouse', 'city']],
  [['41', 'number'], ['chemin', 'street_type'], ['des Vignes', 'street'], ['Étage 3', 'complement'], ['38000', 'postcode'], ['Grenoble', 'city']],
  [['9', 'number'], ['route', 'street_type'], ['de la Forêt', 'street'], ['Porte 12', 'complement'], ['35000', 'postcode'], ['Rennes', 'city']],
];

/** Des segments vers le couple [adresse, une étiquette par mot] attendu. */
function deplier(segments) {
  return [
    segments.map(([texte]) => texte).join(' '),
    segments.flatMap(([texte, etiquette]) => tokenise(texte).map(() => etiquette)),
  ];
}

const MODELE = train(ETIQUETEES.map(deplier));

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
    colonnes: ['Champ', 'Ce que le modèle y met'],
    vide: '— rien',
    note: 'Modèle entraîné sur 18 adresses étiquetées mot par mot.',
  },
  en: {
    colonnes: ['Field', 'What the model puts there'],
    vide: '— nothing',
    note: 'Model trained on 18 addresses tagged word by word.',
  },
};

export default {
  level: 'N1',

  note: {
    fr: 'Le modèle est entraîné dans votre navigateur au chargement de la page, sur les adresses étiquetées écrites juste à côté. Aucune adresse ne part ailleurs.',
    en: 'The model is trained in your browser as the page loads, on the tagged addresses written right beside it. No address leaves the page.',
  },

  run(adresse, lang) {
    const t = T[lang];
    const champs = parse(MODELE, adresse);
    return {
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
        fr: 'Une rue, une résidence et une ville jamais vues',
        en: 'A street, a residence and a town never seen',
      },
      input: '7 rue du Moulin, Résidence Les Charmes, 21000 Dijon',
    },
    {
      label: { fr: 'Deux compléments placés devant la voie', en: 'Two complements put before the street' },
      input: 'Appartement 12, Bâtiment C, 8 rue des Lilas, 75011 Paris',
    },
    {
      label: { fr: 'Tout en capitales, sans une virgule', en: 'All capitals, not a single comma' },
      input: '6 QUAI DES ORMES 67000 STRASBOURG',
    },
    {
      label: { fr: 'Une adresse allemande', en: 'A German address' },
      input: 'Hauptstrasse 5, 10115 Berlin',
      fails: true,
      why: {
        fr: 'Toutes les adresses étiquetées placent le numéro devant et cinq chiffres avant la ville. Ici le nom de la rue porte le type de voie et passe en complément, la voie ressort vide, et le 5 devient un numéro alors qu’il est le numéro… par accident de position. Rien ne permet au modèle de dire qu’il n’a jamais vu ça : il étiquette quand même, et avec le même aplomb. Couvrir un pays de plus, c’est une campagne d’étiquetage de plus.',
        en: 'Every tagged address puts the number first and five digits before the town. Here the street name carries its own street type and lands in the complement, the street comes back empty, and the 5 becomes a house number — right, but by accident of position. Nothing lets the model say it has never seen this: it labels the tokens anyway, with exactly the same confidence. Covering one more country means one more round of hand tagging.',
      },
    },
  ],
};
