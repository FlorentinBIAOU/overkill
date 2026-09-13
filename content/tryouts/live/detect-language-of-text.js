/**
 * Essai interactif — reconnaître la langue d'un texte.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : l'extrait construit
 * un profil à partir de l'échantillon qu'on lui donne, et les échantillons
 * n'en font pas partie. Les trois paragraphes ci-dessous sont donc de la
 * donnée, la même que celle des tests de la fiche, et ils sont tout le modèle :
 * un paragraphe par langue, trois cents trigrammes classés, rien d'autre.
 *
 * Le tableau montre les trois langues et pas seulement la gagnante, parce que
 * l'écart entre les deux premières est la seule mesure honnête de la confiance
 * qu'on peut accorder à la réponse.
 */
import { PROFILE_SIZE, profile, ranked } from '../../snippets/detect-language-of-text/n0.js';

const ECHANTILLONS = {
  fr: `
    Le train est arrivé avec un quart d'heure de retard, et personne sur le quai
    n'a semblé s'en étonner. Les voyageurs sont descendus lentement, leurs sacs à
    la main, puis la gare a retrouvé son calme habituel. Dans la salle d'attente,
    une femme lisait un journal tandis que son fils comptait les carreaux du sol.
    Il faisait froid dehors, mais le soleil de la fin du mois de mars donnait aux
    toits une couleur qui ne dure jamais très longtemps. Nous avons marché jusqu'au
    centre de la ville, où les commerces ouvraient les uns après les autres. Le
    boulanger nous a expliqué que la farine avait encore augmenté cette année, et
    que ses clients ne comprenaient pas toujours pourquoi le prix du pain suivait.
  `,
  en: `
    The train arrived a quarter of an hour late, and nobody on the platform seemed
    surprised by it. The passengers came down slowly, their bags in hand, and then
    the station went back to its usual quiet. In the waiting room a woman was
    reading a newspaper while her son counted the tiles on the floor. It was cold
    outside, but the sun at the end of March gave the roofs a colour that never
    lasts very long. We walked into the centre of the town, where the shops were
    opening one after another. The baker explained that flour had gone up again
    this year, and that his customers did not always understand why the price of
    bread followed.
  `,
  es: `
    El tren llegó con un cuarto de hora de retraso, y nadie en el andén pareció
    sorprenderse. Los viajeros bajaron despacio, con sus bolsas en la mano, y luego
    la estación volvió a su calma de siempre. En la sala de espera una mujer leía
    un periódico mientras su hijo contaba las baldosas del suelo. Hacía frío fuera,
    pero el sol de finales de marzo daba a los tejados un color que nunca dura
    mucho tiempo. Caminamos hasta el centro de la ciudad, donde las tiendas abrían
    una tras otra. El panadero nos explicó que la harina había subido otra vez este
    año, y que sus clientes no siempre entendían por qué el precio del pan seguía.
  `,
};

const PROFILS = new Map(
  Object.entries(ECHANTILLONS).map(([nom, echantillon]) => [nom, profile(echantillon)]),
);

const T = {
  fr: {
    langue: 'Langue',
    distance: `Distance (0 à ${PROFILE_SIZE})`,
    ecart: 'Écart avec la première',
    detail: (deuxieme, ecart) => `${ecart} d’écart avec ${deuxieme}, sur une échelle qui va à ${PROFILE_SIZE}.`,
    maximale: `Les trois langues sont à la distance maximale de ${PROFILE_SIZE} : c’est l’ordre alphabétique qui répond.`,
  },
  en: {
    langue: 'Language',
    distance: `Distance (0 to ${PROFILE_SIZE})`,
    ecart: 'Gap to the first',
    detail: (deuxieme, ecart) => `${ecart} ahead of ${deuxieme}, on a scale that runs to ${PROFILE_SIZE}.`,
    maximale: `All three languages sit at the maximum distance of ${PROFILE_SIZE}: the alphabetical tie-break answers.`,
  },
};

/** Le nom de la langue dans la langue du lecteur, pas son code à deux lettres. */
function nommer(code, lang) {
  return new Intl.DisplayNames([lang], { type: 'language' }).of(code);
}

const arrondi = (valeur) => Math.round(valeur * 10) / 10;

export default {
  level: 'N0',

  note: {
    fr: 'Le modèle est fait de trois paragraphes, un par langue. Une distance basse dit que le texte emploie les mêmes trigrammes que l’échantillon ; l’écart entre les deux premières dit ce que vaut la réponse.',
    en: 'The model is three paragraphs, one per language. A low distance says the text uses the same trigrams as the sample; the gap between the top two says what the answer is worth.',
  },

  run(texte, lang) {
    const t = T[lang];
    const classement = ranked(texte, PROFILS);
    const [gagnante, meilleure] = classement[0];
    const ecart = arrondi(classement[1][1] - meilleure);

    return {
      verdict: {
        label: nommer(gagnante, lang),
        detail:
          ecart === 0 && meilleure === PROFILE_SIZE
            ? t.maximale
            : t.detail(nommer(classement[1][0], lang), ecart),
      },
      rows: {
        columns: [t.langue, t.distance, t.ecart],
        rows: classement.map(([code, distance], rang) => [
          nommer(code, lang),
          { v: String(arrondi(distance)), caught: rang === 0 },
          rang === 0 ? '—' : String(arrondi(distance - meilleure)),
        ]),
      },
    };
  },

  cases: [
    {
      label: { fr: 'Un message de support en français', en: 'A support message in French' },
      input:
        'La réunion de lundi est reportée au mercredi suivant, merci de prévenir les participants.',
    },
    {
      label: {
        fr: 'Le même message crié, sans un seul accent',
        en: 'The same message shouted, without a single accent',
      },
      input:
        'LA REUNION DE LUNDI EST REPORTEE AU MERCREDI SUIVANT !!! MERCI DE PREVENIR LES PARTICIPANTS...',
    },
    {
      label: { fr: 'Un mot seul dans un champ de recherche', en: 'A single word in a search box' },
      input: 'chat',
      fails: true,
      why: {
        fr: 'Le mot est français et ressort en anglais, avec un écart large qui a toutes les apparences de la confiance. Quatre trigrammes seulement, et ce sont ceux que l’anglais emploie dans « that » et « what » : rien dans la sortie n’avertit que la réponse ne repose sur presque rien.',
        en: 'The word is French for cat and comes back as English, with a wide gap that has every appearance of confidence. Four trigrams only, and they are the ones English uses in “that” and “what”: nothing in the output warns that the answer rests on almost nothing.',
      },
    },
    {
      label: {
        fr: 'Un message qui passe du français à l’anglais',
        en: 'A message that switches from French to English',
      },
      input:
        'La réunion de lundi est reportée au mercredi suivant. Please let the London team know as soon as you can.',
      fails: true,
      why: {
        fr: 'La fonction doit nommer une langue, et ce message en a deux. Pire que la gagnante arbitraire : la deuxième est l’espagnol, qui n’est nulle part dans le texte. Les deux moitiés se brouillent, l’écart s’effondre, et cet effondrement est le seul avertissement que l’appelant reçoit.',
        en: 'The function has to name one language, and this message has two. Worse than the arbitrary winner: the runner-up is Spanish, which is nowhere in the text. The two halves interfere, the gap collapses, and that collapse is the only warning the caller ever gets.',
      },
    },
  ],
};
