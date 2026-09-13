/**
 * Essai interactif — valider un formulaire côté serveur.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel. Il valide un objet,
 * pas du texte : la saisie se fait donc une ligne par champ, `champ: valeur`,
 * et `run` la rassemble en objet avant de la soumettre — exactement le travail
 * qu'un serveur fait en décodant un formulaire posté.
 *
 * Une seule conversion a lieu à ce moment-là, et c'est celle du serveur : une
 * valeur entièrement numérique devient un nombre. Sans elle, `age` arriverait
 * en texte et le schéma répondrait « must be of type integer » à chaque essai,
 * ce qui ne dirait rien de l'extrait.
 *
 * Les messages affichés dans la dernière colonne sont ceux que l'extrait
 * renvoie, mot pour mot : c'est sa sortie, on ne la traduit pas.
 */
import { validate } from '../../snippets/validate-a-form-server-side/n0.js';

/* Le schéma est de la donnée : celui d'un formulaire d'inscription, le même
   que les tests de la fiche déclarent, champ pour champ. */
const SCHEMA = {
  email: {
    required: true,
    pattern: '[^@\\s]+@[^@\\s]+\\.[a-z]{2,}',
    message: 'is not a valid email address',
  },
  display_name: { required: true, min: 2, max: 30 },
  age: { required: true, type: 'integer', min: 18, max: 130 },
  website: { pattern: 'https?://\\S+' },
};

const T = {
  fr: {
    champ: 'Champ',
    soumis: 'Valeur soumise',
    reponse: 'Réponse du serveur',
    absent: '(non soumis)',
    accepte: 'accepté',
    valide: 'Formulaire accepté',
    valideDetail: 'Aucune règle du schéma n’est enfreinte.',
    refus: (n) => `${n} champ${n > 1 ? 's' : ''} refusé${n > 1 ? 's' : ''}`,
    refusDetail: 'Une seule règle par champ : on corrige, on renvoie, on voit la suivante.',
  },
  en: {
    champ: 'Field',
    soumis: 'Submitted value',
    reponse: 'Server’s answer',
    absent: '(not submitted)',
    accepte: 'accepted',
    valide: 'Form accepted',
    valideDetail: 'No rule of the schema is broken.',
    refus: (n) => `${n} field${n > 1 ? 's' : ''} refused`,
    refusDetail: 'One rule per field: fix it, resubmit, see the next one.',
  },
};

const ENTIER = /^-?\d+$/;

/** Une ligne `champ: valeur` par champ, comme un corps de requête décodé. */
function lireSaisie(texte) {
  const soumis = {};
  for (const ligne of texte.split('\n')) {
    const separateur = ligne.indexOf(':');
    if (separateur === -1 || ligne.trim() === '') continue;
    const champ = ligne.slice(0, separateur).trim();
    // Pas de découpe sur les deux-points suivants : une URL en contient un.
    const brut = ligne.slice(separateur + 1).trim();
    soumis[champ] = ENTIER.test(brut) ? Number(brut) : brut;
  }
  return soumis;
}

export default {
  level: 'N0',

  note: {
    fr: 'Une ligne par champ. Les messages de la troisième colonne sont ceux que l’extrait produit lui-même.',
    en: 'One line per field. The messages in the third column are the ones the snippet produces itself.',
  },

  run(texte, lang) {
    const t = T[lang];
    const soumis = lireSaisie(texte);
    const erreurs = validate(soumis, SCHEMA);

    const rows = Object.keys(SCHEMA).map((champ) => {
      const valeur = soumis[champ];
      const message = erreurs[champ];
      return [
        champ,
        valeur === undefined ? t.absent : String(valeur),
        message === undefined ? t.accepte : { v: message, caught: true },
      ];
    });

    const nombre = Object.keys(erreurs).length;
    return {
      verdict:
        nombre === 0
          ? { label: t.valide, detail: t.valideDetail }
          : { label: t.refus(nombre), detail: t.refusDetail },
      rows: { columns: [t.champ, t.soumis, t.reponse], rows },
    };
  },

  cases: [
    {
      label: { fr: 'Une inscription bien remplie', en: 'A properly filled sign-up' },
      input:
        'email: marie.durand@exemple.fr\n' +
        'display_name: Marie Durand\n' +
        'age: 34\n' +
        'website: https://menuiserie-dubois.fr',
    },
    {
      label: {
        fr: 'Quatre champs fautifs, quatre messages',
        en: 'Four faulty fields, four messages',
      },
      input:
        'email: marie.durand.exemple.fr\n' +
        'display_name: M\n' +
        'age: 16\n' +
        'website: menuiserie-dubois.fr',
    },
    {
      label: {
        fr: 'Un champ laissé vide, un âge écrit en lettres',
        en: 'A field left blank, an age spelled out',
      },
      input: 'email:\n' + 'display_name: Marie Durand\n' + 'age: trente-quatre',
    },
    {
      label: {
        fr: 'Une adresse bien formée dont la boîte n’existe pas',
        en: 'A well-formed address whose mailbox does not exist',
      },
      input:
        'email: marie.durand@no-such-mailbox.example\n' +
        'display_name: Marie Durand\n' +
        'age: 34',
      fails: true,
      why: {
        fr: 'Le formulaire est accepté : la forme de l’adresse est correcte, et aucune règle ne peut dire si quelqu’un lit le courrier envoyé là. Le savoir demande une vérification externe — un message de confirmation, une interrogation du domaine — qui est un autre besoin.',
        en: 'The form is accepted: the address has the right shape, and no rule can say whether anybody reads mail sent there. Finding out takes an external check — a confirmation message, a lookup on the domain — which is a different need.',
      },
    },
  ],
};
