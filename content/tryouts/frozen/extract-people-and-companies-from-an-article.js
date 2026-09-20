/**
 * Essai figé — typer les noms propres avec un petit modèle auto-hébergé.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il charge un modèle de
 * plusieurs dizaines de mégaoctets. Les six cas ci-dessous sont donc exécutés à
 * la construction du site, avec le double local qui sert déjà aux tests — le
 * même que `n2.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : ce que le
 * code fait autour du modèle. La cartographie des étiquettes, ce qu'il écarte
 * parce qu'il ne sait pas le traduire, ce qu'il écarte parce que le texte ne le
 * contient pas, et ce qu'il fait quand le modèle tombe. Les étiquettes
 * elles-mêmes sont celles que le cas déclare.
 *
 * Chaque cas affiche aussi ce que le niveau N0 répond sur le même texte : c'est
 * la comparaison qui porte le verdict de la fiche, et elle est calculée.
 */
import { FakeClassifier } from '../../snippets/_harness/fake-model.mjs';
import { extractNames as sansModele } from '../../snippets/extract-people-and-companies-from-an-article/n0.js';
import { RecognitionUnavailable, extractNames } from '../../snippets/extract-people-and-companies-from-an-article/n2.js';

/** Le double des tests, plus la panne : un modèle local meurt aussi. */
class ModeleLocal extends FakeClassifier {
  constructor(reponses, meurt = false) {
    super(reponses, { entities: [] });
    this.meurt = meurt;
  }

  async predict(texts) {
    if (this.meurt) throw new Error('le processus du modèle est mort');
    return super.predict(texts);
  }
}

const TYPES = {
  fr: { person: 'personne', company: 'entreprise', place: 'lieu', unknown: 'inconnu' },
  en: { person: 'person', company: 'company', place: 'place', unknown: 'unknown' },
};

const T = {
  fr: {
    colonnes: ['Nom', 'Type rendu', 'Étiquette du modèle'],
    lu: (n) => `${n} nom(s) typé(s) par le modèle`,
    rien: 'Aucun nom typé',
    ecarte: (n) => ` · ${n} étiquette(s) écartée(s) faute de correspondance`,
    n0: (liste) => `Sans modèle, le niveau N0 répond : ${liste}.`,
    n0vide: 'Sans modèle, le niveau N0 ne rend aucun nom sur ce texte.',
    panne: 'Le modèle n’a pas répondu',
    panneDetail: 'Le code lève une erreur nommée plutôt que de rendre une liste vide, qui se lirait comme « aucun nom dans ce texte ».',
  },
  en: {
    colonnes: ['Name', 'Type returned', 'Model label'],
    lu: (n) => `${n} name(s) typed by the model`,
    rien: 'No name typed',
    ecarte: (n) => ` · ${n} label(s) dropped for want of a mapping`,
    n0: (liste) => `Without a model, level N0 answers: ${liste}.`,
    n0vide: 'Without a model, level N0 returns no name on this text.',
    panne: 'The model did not answer',
    panneDetail: 'The code throws a named error rather than returning an empty list, which would read as “no name in this text”.',
  },
};

function resume(texte, lang) {
  const t = T[lang];
  const noms = sansModele(texte).names;
  if (noms.length === 0) return t.n0vide;
  return t.n0(noms.map((n) => `« ${n.text} » ${TYPES[lang][n.type]}`).join(', '));
}

export default {
  level: 'N2',

  note: {
    fr: 'Les étiquettes rendues par le modèle sont simulées par le double local qui sert aux tests. Ce qui est calculé ici, c’est ce que le code en fait : ce qu’il traduit, ce qu’il écarte, et ce qu’il refuse.',
    en: 'The labels the model returns are simulated by the local double the tests use. What is computed here is what the code does with them: what it maps, what it drops, and what it refuses.',
  },

  async run(input, lang, cas = {}) {
    const t = T[lang];
    const simulation = cas.simulate ?? {};
    const entities = (simulation.entities ?? []).map(([texte, label]) => ({
      text: texte,
      label,
      start: input.indexOf(texte),
      end: input.indexOf(texte) + texte.length,
    }));
    const modele = new ModeleLocal({ [input]: { entities } }, simulation.meurt ?? false);

    try {
      const [rapport] = await extractNames([input], modele);
      return {
        rows: {
          columns: t.colonnes,
          rows: rapport.names.map((nom) => [
            { v: nom.text, caught: true }, TYPES[lang][nom.type], nom.evidence,
          ]),
        },
        verdict: {
          label: (rapport.names.length ? t.lu(rapport.names.length) : t.rien)
            + (rapport.unmapped.length ? t.ecarte(rapport.unmapped.length) : ''),
        },
        note: resume(input, lang),
      };
    } catch (erreur) {
      return {
        verdict: {
          label: t.panne,
          detail: erreur instanceof RecognitionUnavailable ? t.panneDetail : String(erreur),
        },
        note: resume(input, lang),
      };
    }
  },

  cases: [
    {
      label: { fr: 'Un paragraphe de presse, avec ses marqueurs', en: 'A press paragraph, with its markers' },
      input: {
        fr: 'Le contrat lie la société Lumière SARL à Jean de La Fontaine et à Mme Marie Martin, de Lyon.',
        en: 'The contract binds the company Lumiere Ltd to Jean de La Fontaine and to Mrs Marie Martin, of Lyon.',
      },
      simulate: {
        entities: [['Lumière SARL', 'ORG'], ['Jean de La Fontaine', 'PER'],
          ['Marie Martin', 'PER'], ['Lyon', 'LOC']],
      },
    },
    {
      label: { fr: 'Le même paragraphe, sans aucun marqueur', en: 'The same paragraph, with no marker at all' },
      input: {
        fr: 'Le contrat lie Lumière à Jean de La Fontaine et à Marie Martin, de Lyon.',
        en: 'The contract binds Lumiere to Jean de La Fontaine and to Marie Martin, of Lyon.',
      },
      simulate: {
        entities: [['Lumière', 'ORG'], ['Jean de La Fontaine', 'PER'],
          ['Marie Martin', 'PER'], ['Lyon', 'LOC']],
      },
    },
    {
      label: { fr: 'Une étiquette que la fiche ne sait pas traduire', en: 'A label this entry cannot map' },
      input: {
        fr: 'Le prix Goncourt a été remis à Marie Martin à Paris.',
        en: 'The Goncourt prize was awarded to Marie Martin in Paris.',
      },
      simulate: { entities: [['Goncourt', 'MISC'], ['Marie Martin', 'PER'], ['Paris', 'LOC']] },
    },
    {
      label: { fr: 'Le modèle rend un nom que le texte ne contient pas', en: 'The model returns a name the text does not contain' },
      input: {
        fr: 'Le colis part de Lyon mercredi.',
        en: 'The parcel leaves Lyon on Wednesday.',
      },
      simulate: { entities: [['Lyon', 'LOC'], ['Marseille', 'LOC']] },
    },
    {
      label: { fr: 'Le modèle se trompe de type, et rien ne permet d’en douter', en: 'The model gets the type wrong, and nothing lets you doubt it' },
      input: {
        fr: 'Le colis part de Lyon mercredi.',
        en: 'The parcel leaves Lyon on Wednesday.',
      },
      simulate: { entities: [['Lyon', 'ORG']] },
      fails: true,
      why: {
        fr: 'Le modèle rend « Lyon » comme une entreprise, et le rapport l’affiche comme telle : il n’y a ni score, ni seuil, ni « inconnu » sur quoi retomber, parce que le pipeline n’en rend pas. Ce que le code peut vérifier — que le nom figure bien dans le texte, que l’étiquette est traduisible — est vérifié ; ce qu’il ne peut pas vérifier, c’est si l’étiquette est juste. Le niveau N0, lui, répond « inconnu » sur ce même nom, ce qui est exactement ce que la phrase prouve : la note sous le tableau le montre à chaque cas.',
        en: 'The model returns “Lyon” as a company, and the report shows it as one: there is no score, no threshold, and no “unknown” to fall back on, because the pipeline returns none. What the code can check — that the name really is in the text, that the label can be mapped — is checked; what it cannot check is whether the label is right. Level N0 answers “unknown” on that same name, which is exactly what the sentence proves: the note under the table shows it on every case.',
      },
    },
    {
      label: { fr: 'Le processus du modèle meurt', en: 'The model worker dies' },
      input: {
        fr: 'Le colis part de Lyon mercredi.',
        en: 'The parcel leaves Lyon on Wednesday.',
      },
      simulate: { entities: [['Lyon', 'LOC']], meurt: true },
      shown: {
        fr: 'le même texte, mais le modèle ne répond pas',
        en: 'the same text, but the model does not answer',
      },
    },
  ],
};
