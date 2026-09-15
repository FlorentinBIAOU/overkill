/**
 * Essai interactif — repérer une anomalie dans une métrique.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel : ce qui tourne dans
 * le navigateur est exactement ce que la fiche affiche au-dessus.
 *
 * La saisie est la série elle-même, une valeur par minute : c'est la seule
 * entrée que l'extrait connaisse, et la seule qui permette de comparer une
 * pointe à une dérive sans changer le code. Les quatre séries des cas ne
 * diffèrent que par ce qui arrive à la treizième minute : la fenêtre qui les
 * précède est la même, et les verdicts sont donc comparables entre eux.
 */
import { scan } from '../../snippets/detect-anomalies-in-metrics/n0.js';

/**
 * Fenêtre de douze minutes, et non les vingt-quatre par défaut : la série tient
 * alors dans un champ de saisie qu'on peut relire. Le reste est inchangé, seuil
 * compris.
 */
const OPTIONS = { window: 12, threshold: 3.5 };

const T = {
  fr: {
    colonnes: ['Minute', 'Mesuré', 'Habituel', 'Écart', 'Écart toléré'],
    note: (anomalies, juges, total) => `${anomalies} anomalie${anomalies > 1 ? 's' : ''} sur ${juges} minute${juges > 1 ? 's' : ''} jugée${juges > 1 ? 's' : ''}, ${total} point${total > 1 ? 's' : ''} fourni${total > 1 ? 's' : ''}. Les ${OPTIONS.window} premières minutes ne sont pas jugées : elles servent de fenêtre.`,
    calme: 'Aucune anomalie',
    calmeDetail: (juges, depart, fin) => `${juges} minutes jugées, aucune ne dépasse l’écart toléré. La métrique est passée de ${depart} à ${fin}.`,
    courte: 'Pas assez d’historique',
    courteDetail: (n) => `${n} point${n > 1 ? 's' : ''} fourni${n > 1 ? 's' : ''} : il en faut plus de ${OPTIONS.window} pour qu’un point ait une fenêtre derrière lui.`,
    illisible: 'Aucun nombre à lire dans cette saisie.',
  },
  en: {
    colonnes: ['Minute', 'Measured', 'Usual', 'Gap', 'Gap allowed'],
    note: (anomalies, juges, total) => `${anomalies} anomal${anomalies > 1 ? 'ies' : 'y'} over ${juges} minute${juges > 1 ? 's' : ''} judged, ${total} point${total > 1 ? 's' : ''} given. The first ${OPTIONS.window} minutes are not judged: they are the window.`,
    calme: 'No anomaly',
    calmeDetail: (juges, depart, fin) => `${juges} minutes judged, not one of them past the allowed gap. The metric went from ${depart} to ${fin}.`,
    courte: 'Not enough history',
    courteDetail: (n) => `${n} point${n > 1 ? 's' : ''} given: more than ${OPTIONS.window} are needed before a point has a window behind it.`,
    illisible: 'No number to read in this input.',
  },
};

/**
 * Un nombre tel que chaque langue l'écrit. En anglais, une virgule suivie de
 * trois chiffres sépare les milliers (4,800) et le point marque les décimales.
 * En français, la virgule marque les décimales et les milliers se séparent par
 * une espace insécable (4 800). Une espace ordinaire sépare deux minutes :
 * « 1080 1120 » est deux points, et « 4 800 » aussi.
 */
const NOMBRE = {
  en: /-?\d{1,3}(?:,\d{3})+(?:\.\d+)?(?!\d)|-?\d+(?:\.\d+)?/g,
  fr: /-?\d{1,3}(?:[\u00a0\u202f]\d{3})+(?:[.,]\d+)?(?!\d)|-?\d+(?:[.,]\d+)?/g,
};

const lire = (texte, lang) => Number(lang === 'en'
  ? texte.replaceAll(',', '')
  : texte.replace(/[\u00a0\u202f]/g, '').replace(',', '.'));

/** La saisie telle qu'on la tape : des nombres séparés par ce qu'on veut. */
function serie(saisie, lang) {
  return (saisie.match(NOMBRE[lang]) ?? []).map((n) => lire(n, lang));
}

/**
 * Où chaque nombre de la série se trouve dans la saisie. `scan` désigne les
 * minutes par leur rang dans la série ; ce rang est le même que celui des
 * occurrences du nombre dans le texte, puisque la série vient de là.
 */
function emplacements(saisie, lang) {
  return [...saisie.matchAll(NOMBRE[lang])].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }));
}

export default {
  level: 'N0',

  note: {
    fr: 'Chaque verdict porte les nombres qui l’ont produit : la valeur mesurée, ce que les douze minutes précédentes appelaient normal, l’écart entre les deux, et l’écart qui était toléré.',
    en: 'Every verdict carries the numbers that produced it: the measured value, what the preceding twelve minutes called normal, the gap between the two, and the gap that was allowed.',
  },

  run(saisie, lang) {
    const t = T[lang];
    const points = serie(saisie, lang);
    if (points.length === 0) return { error: t.illisible };

    const verdicts = scan(points, OPTIONS);
    if (verdicts.length === 0) {
      return { verdict: { label: t.courte, detail: t.courteDetail(points.length) } };
    }

    const anomalies = verdicts.filter((verdict) => verdict.isAnomaly);
    if (anomalies.length === 0) {
      /* Le silence n'est un résultat que si on dit sur quoi il porte : combien
         de minutes ont été jugées, et où la métrique a fini. */
      return {
        // La série est montrée sans un surlignage : la hausse étalée du
        // quatrième cas se lit là, et nulle part ailleurs.
        spans: [],
        verdict: {
          label: t.calme,
          detail: t.calmeDetail(verdicts.length, points[0], points[points.length - 1]),
        },
      };
    }

    const places = emplacements(saisie, lang);
    return {
      /* La minute signalée est surlignée dans la série elle-même : sans cela,
         il fallait compter les nombres à la main pour savoir laquelle. */
      spans: anomalies
        .map((verdict) => places[verdict.index])
        .filter(Boolean),
      rows: {
        columns: t.colonnes,
        rows: anomalies.map((verdict) => [
          String(verdict.index),
          { v: String(verdict.value), caught: true },
          String(verdict.usual),
          String(Math.round(verdict.deviation)),
          String(Math.round(verdict.limit)),
        ]),
      },
      note: t.note(anomalies.length, verdicts.length, points.length),
    };
  },

  /* Les séries restent des chaînes simples : une suite de requêtes par minute
     ne se traduit pas. */
  cases: [
    {
      label: { fr: 'Une pointe à 4 800 requêtes', en: 'A spike to 4,800 requests' },
      input: '1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 4800 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280',
    },
    {
      label: { fr: 'Deux pointes de suite', en: 'Two spikes in a row' },
      input: '1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 4800 4700 1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1280',
    },
    {
      label: { fr: 'Une marche de 1 400 d’un coup', en: 'A step of 1,400 all at once' },
      input: '1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 2680 2720 2480 2520 2560 2600 2640 2680 2720 2480 2520 2560 2600 2640 2680 2720 2480 2520 2560 2600 2640 2680 2720 2480 2520 2560 2600 2640 2680 2720 2480 2520 2560 2600 2640 2680',
    },
    {
      label: { fr: 'Une hausse de 1 440, étalée sur trente-six minutes', en: 'A rise of 1,440, spread over thirty-six minutes' },
      input: '1080 1120 1160 1200 1240 1280 1320 1080 1120 1160 1200 1240 1320 1400 1200 1280 1360 1440 1520 1600 1680 1480 1560 1640 1720 1800 1880 1960 1760 1840 1920 2000 2080 2160 2240 2040 2120 2200 2280 2360 2440 2520 2320 2400 2480 2560 2640 2720',
      fails: true,
      why: {
        fr: 'La métrique finit à 2 720 en partant de 1 080, et pas une minute n’est signalée. La hausse est de quarante requêtes par minute, bien moins que l’écart toléré, et la fenêtre a déjà avalé les pas précédents : l’habituel monte avec la série, et l’écart ne franchit jamais la limite. Une marche de 1 400 livrée d’un coup, au cas précédent, est signalée dès sa première minute — puis cesse de l’être, pour la même raison.',
        en: 'The metric ends at 2,720 having started at 1,080, and not one minute is ever flagged. The rise is forty requests a minute, far below the allowed gap, and the window has already swallowed the steps before it: the usual value climbs with the series, and the gap never crosses the limit. A step of 1,400 delivered all at once, in the previous case, is caught on its first minute — and then stops being caught, for the same reason.',
      },
    },
  ],
};
