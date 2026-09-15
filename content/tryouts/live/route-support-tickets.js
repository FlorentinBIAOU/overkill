/**
 * Essai interactif — router un ticket de support vers la bonne équipe.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * Ce niveau n'a pas de règles, il n'a qu'une archive : tout ce qu'il sait des
 * trois équipes, il l'a lu dans vingt et un tickets déjà résolus, écrits
 * ci-dessous. Une archive française n'apprend rien de l'anglais, il y en a
 * donc deux, une par langue, et la page entraîne celle dont elle a besoin.
 *
 * L'essai montre le classement complet et pas seulement la première équipe,
 * parce que c'est là qu'est le gain du niveau : le ticket qui appartient à
 * deux équipes le dit, au lieu d'être tranché en silence par un ordre de
 * priorité.
 */
import { DEFAULT_TEAM, rank, route, train } from '../../snippets/route-support-tickets/n1.js';

/* Une archive telle qu'un export de l'outil de ticketing la donne : le ticket,
   et l'équipe qui l'a fermé. Rien d'autre n'est disponible, et rien d'autre
   n'est nécessaire. */
const ARCHIVE_FR = {
  billing: [
    'Ma facture de janvier est trop élevée, pouvez-vous vérifier le montant',
    'Je demande le remboursement de la commande que j’ai annulée hier',
    'Le prélèvement automatique est passé deux fois ce mois-ci',
    'Pouvez-vous m’envoyer un devis pour dix licences supplémentaires',
    'Mon IBAN a changé, comment mettre à jour le moyen de paiement',
    'Je ne comprends pas la ligne de TVA sur la facture de 2024',
    'Le paiement par carte a été refusé trois fois de suite',
  ],
  technical: [
    'Impossible de me connecter depuis ce matin, la page reste blanche',
    'L’application plante dès que j’ouvre le tableau de bord',
    'J’ai perdu mon mot de passe et le lien de réinitialisation ne marche pas',
    'Une erreur 500 s’affiche quand j’enregistre une fiche',
    'La synchronisation est en panne depuis la mise à jour de mardi',
    'Mon identifiant ne fonctionne plus après le changement de poste',
    'Le bouton d’export ne répond plus dans le navigateur',
  ],
  shipping: [
    'Mon colis n’est toujours pas arrivé après trois semaines',
    'La livraison a été annulée par le transporteur sans explication',
    'Le suivi indique livré mais je n’ai rien reçu',
    'Je souhaite changer l’adresse de livraison de ma commande',
    'L’expédition est bloquée au dépôt depuis lundi',
    'Le colis est arrivé ouvert et un article manque',
    'Le retard de livraison dépasse la date annoncée',
  ],
};

const ARCHIVE_EN = {
  billing: [
    'My January invoice is too high, could you check the amount',
    'I am asking for a refund of the order I cancelled yesterday',
    'The direct debit was taken twice this month',
    'Could you send me a quote for ten additional licences',
    'My bank details have changed, how do I update the payment method',
    'I do not understand the VAT line on the 2024 invoice',
    'The card payment was declined three times in a row',
  ],
  technical: [
    'I cannot log in since this morning, the page stays blank',
    'The application crashes as soon as I open the dashboard',
    'I lost my password and the reset link does not work',
    'A 500 error appears when I save a record',
    'Synchronisation has been down since the tuesday update',
    'My login stopped working after I changed desk',
    'The export button no longer responds in the browser',
  ],
  shipping: [
    'My parcel still has not arrived after three weeks',
    'The delivery was cancelled by the carrier with no explanation',
    'Tracking says delivered but I received nothing',
    'I would like to change the delivery address of my order',
    'The shipment has been stuck at the depot since monday',
    'The parcel arrived open and one item is missing',
    'The delivery delay is past the announced date',
  ],
};

/** L'archive à plat, telle que `train` la lit : un ticket, une équipe. */
function entrainer(archive) {
  const tickets = [];
  const equipes = [];
  for (const [equipe, liste] of Object.entries(archive)) {
    for (const ticket of liste) {
      tickets.push(ticket);
      equipes.push(equipe);
    }
  }
  return train(tickets, equipes);
}

const MODELES = { fr: entrainer(ARCHIVE_FR), en: entrainer(ARCHIVE_EN) };

// Le plancher de confiance est celui de l'extrait. En dessous, le ticket ne
// part pas chez l'équipe la moins invraisemblable, il part chez un humain.
const PLANCHER = 0.5;

const EQUIPES = {
  billing: { fr: 'Facturation', en: 'Billing' },
  technical: { fr: 'Technique', en: 'Technical' },
  shipping: { fr: 'Livraison', en: 'Shipping' },
};

const T = {
  fr: {
    colonnes: ['Équipe', 'Confiance du modèle'],
    part: (equipe) => `Le ticket part chez ${equipe}`,
    defaut: 'Le ticket repart dans la file par défaut',
    sur: (score) => `${score} de confiance, au-dessus du plancher de ${pourcent(PLANCHER, 'fr')}.`,
    sous: (score) =>
      `Meilleure équipe à ${score} seulement, sous le plancher de ${pourcent(PLANCHER, 'fr')} : personne ne tranche à la place d’un humain.`,
    note: 'Modèle entraîné sur 21 tickets résolus, sept par équipe.',
  },
  en: {
    colonnes: ['Team', 'Model confidence'],
    part: (equipe) => `The ticket goes to ${equipe}`,
    defaut: 'The ticket returns to the default queue',
    sur: (score) => `${score} confidence, above the ${pourcent(PLANCHER, 'en')} floor.`,
    sous: (score) =>
      `Best team at only ${score}, below the ${pourcent(PLANCHER, 'en')} floor: nothing decides in a human’s place.`,
    note: 'Model trained on 21 resolved tickets, seven per team.',
  },
};

function pourcent(valeur, lang) {
  const entier = Math.round(valeur * 100);
  return lang === 'fr' ? `${entier} %` : `${entier}%`;
}

export default {
  level: 'N1',

  note: {
    fr: 'Le modèle est entraîné dans votre navigateur au chargement de la page, sur l’archive de tickets résolus écrite juste à côté. Aucun ticket ne part ailleurs.',
    en: 'The model is trained in your browser as the page loads, on the archive of resolved tickets written right beside it. No ticket leaves the page.',
  },

  run(ticket, lang) {
    const t = T[lang];
    const modele = MODELES[lang];
    const classement = rank(modele, ticket);
    const destination = route(modele, ticket, { minConfidence: PLANCHER });
    const [, meilleur] = classement[0];
    const retenue = destination !== DEFAULT_TEAM;
    return {
      verdict: {
        label: destination === DEFAULT_TEAM ? t.defaut : t.part(EQUIPES[destination][lang]),
        detail: retenue ? t.sur(pourcent(meilleur, lang)) : t.sous(pourcent(meilleur, lang)),
      },
      rows: {
        columns: t.colonnes,
        rows: classement.map(([equipe, score], i) => [
          { v: EQUIPES[equipe][lang], caught: retenue && i === 0 },
          pourcent(score, lang),
        ]),
      },
      note: t.note,
    };
  },

  cases: [
    {
      label: { fr: 'Un prélèvement passé deux fois', en: 'A direct debit taken twice' },
      input: {
        fr: 'Le prélèvement de février est passé deux fois sur mon compte',
        en: 'The February direct debit was taken twice from my account',
      },
    },
    {
      label: {
        fr: 'Un symptôme décrit avec les mots du client',
        en: 'A symptom described in the customer’s own words',
      },
      input: {
        fr: 'La page reste blanche quand je valide le formulaire',
        en: 'The page stays blank when I submit the form',
      },
    },
    {
      label: { fr: 'Un ticket qui appartient à deux équipes', en: 'A ticket that belongs to two teams' },
      input: {
        fr: 'Mon colis n’est pas arrivé et le prélèvement automatique est passé quand même',
        en: 'The parcel has not arrived and the payment was taken anyway',
      },
    },
    {
      label: { fr: 'Une question que personne n’a jamais traitée', en: 'A question nobody has ever handled' },
      fails: true,
      input: {
        fr: 'Votre entrepôt accepte-t-il les visites scolaires le mercredi',
        en: 'Does your warehouse accept school visits on wednesdays',
      },
      why: {
        fr: 'De ce ticket, l’archive ne connaît que le mot « le » : les trois équipes ressortent presque à égalité, le plancher n’est pas atteint, et le ticket repart dans la file par défaut. N1 n’a pas supprimé cette file, il l’a rétrécie — et chaque nouveau type de ticket doit être traité, étiqueté et ajouté à l’archive à la main avant que le modèle sache le router.',
        en: 'Of this ticket, the archive only knows « does » and « on »: no team stands out, the best one stays under the floor, and the ticket returns to the default queue. N1 did not remove that queue, it made it smaller — and every new kind of ticket has to be answered, labelled and added to the archive by hand before the model can route it.',
      },
    },
  ],
};
