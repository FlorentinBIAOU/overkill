/**
 * Essai figé — traduire les libellés d'interface avec un modèle auto-hébergé.
 *
 * Cet extrait ne peut pas tourner dans un navigateur : il charge un fichier de
 * modèle par couple de langues. Les six cas ci-dessous sont donc exécutés à la
 * construction du site, avec le double local qui sert déjà aux tests — le même
 * que `n2.test.js`.
 *
 * Ce qui est réellement calculé ici, et que rien n'écrit à la main : ce que le
 * code fait autour de la traduction. La variable est cachée avant que le modèle
 * ne voie la chaîne — chaque cas affiche ce qu'il a reçu, et c'est la preuve —
 * remise en place après, comptée, et l'écart signalé. La traduction elle-même
 * est celle que le cas déclare.
 *
 * Les libellés sont des chaînes d'interface anglaises traduites vers le
 * français : c'est le sens de ce modèle-là, et cela ne change pas selon la
 * langue de la page. Les exemples sont donc les mêmes des deux côtés.
 */
import { FakeSeq2Seq } from '../../snippets/_harness/fake-model.mjs';
import { TranslationUnavailable, translate } from '../../snippets/translate-interface-strings/n2.js';

/**
 * Le double des tests, plus la panne : un modèle local meurt aussi, processus
 * tombé ou mémoire épuisée, et c'est la moitié du code de l'extrait.
 */
class ModeleLocal extends FakeSeq2Seq {
  constructor(reponse, meurt = 0) {
    super({}, reponse);
    this.meurt = meurt;
  }

  async generate(texte) {
    if (this.meurt > 0) {
      this.meurt -= 1;
      this.calls.push(texte);
      throw new Error('le processus du modèle est mort');
    }
    return super.generate(texte);
  }
}

const T = {
  fr: {
    acceptee: 'Traduction acceptée',
    accepteeDetail: 'Les variables de la source sont toutes revenues, celles-là et pas d’autres.',
    relire: 'Renvoyée en relecture',
    ecart: (avertissement) => `L’extrait signale l’écart : ${avertissement}.`,
    refusee: 'Traduction refusée',
    refuseeDetail:
      'Le modèle n’a rien rendu d’exploitable. Le code préfère lever une erreur plutôt que de livrer un libellé vide.',
    recu: (texte, appels) =>
      `Le modèle a reçu « ${texte} » — ${appels} ${appels > 1 ? 'appels' : 'appel'}.`,
  },
  en: {
    acceptee: 'Translation accepted',
    accepteeDetail: 'Every variable of the source came back, those and no others.',
    relire: 'Sent back for review',
    ecart: (avertissement) => `The snippet reports the mismatch: ${avertissement}.`,
    refusee: 'Translation refused',
    refuseeDetail:
      'The model returned nothing usable. The code raises rather than shipping a blank label.',
    recu: (texte, appels) => `The model received “${texte}” — ${appels} call${appels > 1 ? 's' : ''}.`,
  },
};

export default {
  level: 'N2',

  note: {
    fr: 'La traduction rendue par le modèle est simulée par le double local qui sert aux tests. Ce qui est calculé ici, c’est ce que le code lui envoie, ce qu’il réessaie, ce qu’il remet en place et ce qu’il refuse de livrer.',
    en: 'The translation the model returns is simulated by the local double the tests use. What is computed here is what the code sends it, what it retries, what it puts back and what it refuses to ship.',
  },

  /* La réponse du modèle est portée par le cas : deux cas partagent la même
     chaîne source et ne se distinguent que par ce que le modèle rend. */
  async run(source, lang, cas = {}) {
    const t = T[lang];
    const simulation = cas.simulate ?? {};
    const modele = new ModeleLocal(simulation.reponse ?? '', simulation.meurt ?? 0);
    try {
      const { target, review, warnings } = await translate(source, { model: modele, attempts: 2 });
      return {
        output: target,
        verdict: {
          label: review ? t.relire : t.acceptee,
          detail: review ? t.ecart(warnings.join(' ')) : t.accepteeDetail,
        },
        note: t.recu(modele.calls[0], modele.calls.length),
      };
    } catch (erreur) {
      return {
        verdict: {
          label: t.refusee,
          detail: erreur instanceof TranslationUnavailable ? t.refuseeDetail : String(erreur),
        },
        note: t.recu(modele.calls[0], modele.calls.length),
      };
    }
  },

  cases: [
    {
      label: { fr: 'Un libellé de bouton, sans variable', en: 'A button label, no variable' },
      input: 'Save changes',
      simulate: { reponse: 'Enregistrer les modifications' },
    },
    {
      /* « [0] » est le marqueur que l'extrait glisse à la place de la variable.
         Il figure ici parce que le double rejoue ce qu'un modèle rendrait, et
         un modèle rend ce qu'on lui a donné : le `note` de chaque cas affiche
         la chaîne réellement reçue, qui le démontre. */
      label: { fr: 'Une chaîne avec un nombre dedans', en: 'A string with a number in it' },
      input: '{count} items selected',
      simulate: { reponse: '[0] éléments sélectionnés' },
    },
    {
      label: {
        fr: 'Deux variables, et le français les remet dans l’autre ordre',
        en: 'Two variables, and French puts them the other way round',
      },
      input: 'Delete {count} of {total}',
      simulate: { reponse: 'Sur [1], supprimer [0]' },
    },
    {
      label: { fr: 'Le processus du modèle meurt au premier appel', en: 'The model worker dies on the first call' },
      input: 'Save',
      simulate: { reponse: 'Enregistrer', meurt: 1 },
      shown: {
        fr: 'le même libellé, mais le premier appel au modèle échoue',
        en: 'the same label, but the first call to the model fails',
      },
    },
    {
      label: { fr: 'Le modèle ne rend que des espaces', en: 'The model returns nothing but spaces' },
      input: 'Save',
      simulate: { reponse: '   ' },
      shown: {
        fr: 'le même libellé ; le modèle répond deux fois par du blanc',
        en: 'the same label; the model answers whitespace twice',
      },
    },
    {
      label: { fr: 'Le modèle perd la variable en route', en: 'The model loses the variable on the way' },
      input: '{count} items selected',
      simulate: { reponse: 'Des éléments sélectionnés' },
      shown: {
        fr: 'la même chaîne ; le modèle répond « Des éléments sélectionnés »',
        en: 'the same string; the model answers “Des éléments sélectionnés”',
      },
      fails: true,
      why: {
        fr: 'Le marqueur « [0] » n’est pas revenu : la phrase française est correcte, et il n’y a plus de nombre dedans. L’extrait ne peut pas empêcher le modèle de le perdre — il peut seulement refuser d’appeler cela une traduction finie, et c’est ce qu’il fait ici. Cette réponse est écrite par le double local, pas obtenue du vrai modèle.',
        en: 'The marker “[0]” did not come back: the French sentence is correct, and there is no longer a number in it. The snippet cannot stop the model losing it — it can only refuse to call the result a finished translation, which is what it does here. This answer is written by the local double, not obtained from the real model.',
      },
    },
  ],
};
