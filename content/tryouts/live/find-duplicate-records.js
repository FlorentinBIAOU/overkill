/**
 * Essai interactif — trouver les doublons d'un fichier.
 *
 * Le vrai extrait du niveau recommandé, importé tel quel. Une fiche par ligne,
 * `nom ; code postal ; ville`, parce que l'extrait travaille sur des
 * enregistrements et que la clé de blocage se calcule sur deux de ces champs.
 *
 * La phrase sous le tableau est l'essentiel de l'essai. L'extrait ne compare
 * jamais toutes les paires : il groupe d'abord, et c'est ce qui le garde rapide
 * quand le fichier grossit. Le compte des comparaisons réellement faites, et la
 * paire la plus ressemblante que le groupement a écartée sans la regarder,
 * disent ce que ce marché coûte — les deux sont calculés avec les fonctions que
 * l'extrait expose, `blockingKey` et `similarity`.
 */
import {
  blockingKey,
  findDuplicates,
  recordText,
  similarity,
} from '../../snippets/find-duplicate-records/n0.js';

/* Le seuil par défaut de l'extrait, redit ici pour l'afficher. */
const SEUIL = 0.85;

const T = {
  fr: {
    ficheA: 'Fiche',
    ficheB: 'En doublon avec',
    score: (seuil) => `Score (seuil ${seuil})`,
    aucun: 'Aucun doublon trouvé',
    aucunDetail: 'Aucune paire comparée n’atteint le seuil.',
    comparaisons: (faites, total) =>
      `${faites} comparaison${faites > 1 ? 's' : ''} effectuée${faites > 1 ? 's' : ''} sur ${total} paire${total > 1 ? 's' : ''} possible${total > 1 ? 's' : ''} : les autres ne partagent pas la clé de blocage.`,
    jamais: (a, b, score) =>
      ` Jamais comparées, et pourtant semblables à ${score} : « ${a} » et « ${b} ».`,
    seule: 'Une seule fiche',
    seuleDetail: 'Ajoutez une ligne par fiche : nom ; code postal ; ville.',
  },
  en: {
    ficheA: 'Record',
    ficheB: 'Duplicate of',
    score: (seuil) => `Score (cut at ${seuil})`,
    aucun: 'No duplicate found',
    aucunDetail: 'No compared pair reaches the cut.',
    comparaisons: (faites, total) =>
      `${faites} comparison${faites > 1 ? 's' : ''} run out of ${total} possible pair${total > 1 ? 's' : ''}: the others do not share the blocking key.`,
    jamais: (a, b, score) =>
      ` Never compared, and yet ${score} alike: “${a}” and “${b}”.`,
    seule: 'Only one record',
    seuleDetail: 'Add one line per record: name ; postcode ; town.',
  },
};

/** Une fiche par ligne, trois champs séparés par des points-virgules. */
function lireFiches(texte) {
  return texte
    .split('\n')
    .filter((ligne) => ligne.trim() !== '')
    .map((ligne) => {
      const [name = '', postcode = '', city = ''] = ligne.split(';').map((champ) => champ.trim());
      return { name, postcode, city };
    });
}

const etiquette = ({ name, postcode }) => `${name}, ${postcode}`;

export default {
  level: 'N0',

  note: {
    fr: 'Une fiche par ligne : nom ; code postal ; ville. Deux fiches qui ne partagent pas trois lettres de nom de famille et le même code postal ne sont jamais comparées.',
    en: 'One record per line: name ; postcode ; town. Two records that do not share three letters of family name and the same postcode are never compared.',
  },

  run(texte, lang) {
    const t = T[lang];
    const fiches = lireFiches(texte);
    if (fiches.length < 2) {
      return { verdict: { label: t.seule, detail: t.seuleDetail } };
    }

    const paires = findDuplicates(fiches, SEUIL);
    const nombre = new Intl.NumberFormat(lang, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    // Ce que le blocage a fait, et ce qu'il a coûté : les comparaisons faites,
    // et la meilleure paire qu'il n'a pas laissé comparer.
    let faites = 0;
    let manquee = null;
    for (let i = 0; i < fiches.length; i += 1) {
      for (let j = i + 1; j < fiches.length; j += 1) {
        if (blockingKey(fiches[i]) === blockingKey(fiches[j])) {
          faites += 1;
          continue;
        }
        const score = similarity(recordText(fiches[i]), recordText(fiches[j]));
        if (score >= SEUIL && (manquee === null || score > manquee.score)) {
          manquee = { score, a: fiches[i], b: fiches[j] };
        }
      }
    }

    const total = (fiches.length * (fiches.length - 1)) / 2;
    const note =
      t.comparaisons(faites, total) +
      (manquee
        ? t.jamais(etiquette(manquee.a), etiquette(manquee.b), nombre.format(manquee.score))
        : '');

    if (paires.length === 0) {
      return { verdict: { label: t.aucun, detail: t.aucunDetail }, note };
    }

    return {
      rows: {
        columns: [t.ficheA, t.ficheB, t.score(nombre.format(SEUIL))],
        rows: paires.map(([i, j, score]) => [
          etiquette(fiches[i]),
          etiquette(fiches[j]),
          { v: nombre.format(score), caught: true },
        ]),
      },
      note,
    };
  },

  cases: [
    {
      label: {
        fr: 'Cinq fiches clients, deux saisies deux fois',
        en: 'Five customer records, two of them entered twice',
      },
      input:
        'Jean Dupont ; 75011 ; Paris\n' +
        'Jean Dupônt ; 75011 ; PARIS\n' +
        'Marie Martin ; 69003 ; Lyon\n' +
        'Marie Martln ; 69003 ; Lyon\n' +
        'Paul Bernard ; 33000 ; Bordeaux',
    },
    {
      label: {
        fr: 'Trois Dupont à la même adresse',
        en: 'Three Duponts at the same address',
      },
      input:
        'Jean Dupont ; 75011 ; Paris\n' +
        'Jeanne Dupont ; 75011 ; Paris\n' +
        'Sophie Dupont ; 75011 ; Paris',
    },
    {
      label: {
        fr: 'Un chiffre de travers dans le code postal, un nom saisi à l’envers',
        en: 'One wrong digit in the postcode, one name entered back to front',
      },
      input:
        'Jean Dupont ; 75011 ; Paris\n' +
        'Jean Dupont ; 75012 ; Paris\n' +
        'Dupont Jean ; 75011 ; Paris',
      fails: true,
      why: {
        fr: 'Les trois lignes sont le même client et rien ne sort, quel que soit le seuil : aucune des trois paires ne partage la clé de blocage, donc aucune comparaison n’a lieu. La phrase sous le résultat le dit : deux de ces fiches se ressemblent à 0,96 et n’ont jamais été mises côte à côte.',
        en: 'All three lines are the same customer and nothing comes out, whatever the threshold: none of the three pairs shares the blocking key, so no comparison is ever run. The line under the result says it: two of these records are 0.96 alike and were never put side by side.',
      },
    },
  ],
};
