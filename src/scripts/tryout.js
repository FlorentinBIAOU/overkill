/**
 * La zone d'essai interactive.
 *
 * Le module d'essai de la fiche est chargé à la demande : il n'y a qu'une
 * seule zone par page, donc un seul module, et une fiche sans essai ne
 * télécharge rien. Ce module-là importe le vrai fichier d'extrait de la fiche :
 * le code qui tourne dans le navigateur est exactement celui qui est affiché
 * au-dessus.
 *
 * Le rendu passe par le module commun au site et au navigateur, pour que ce
 * qu'on voit après la première frappe soit construit comme ce qu'on voyait
 * avant.
 */
import { renderResult } from '../lib/tryout-render.mjs';
import { bilingual, caseInput } from '../lib/tryout-case.mjs';

const MODULES = import.meta.glob('../../content/tryouts/live/*.js');

const zone = document.querySelector('[data-tryout]');
if (zone) setUp(zone);

async function setUp(zone) {
  const loader = MODULES[`../../content/tryouts/live/${zone.dataset.tryout}.js`];
  if (!loader) return;

  const champ = zone.querySelector('[data-tryout-input]');
  const sortie = zone.querySelector('[data-tryout-result]');
  const casses = zone.querySelector('[data-tryout-why]');
  const texteCasse = zone.querySelector('[data-tryout-why-text]');
  const boutons = [...zone.querySelectorAll('[data-tryout-case]')];
  if (!champ || !sortie) return;

  const labels = JSON.parse(zone.dataset.tryoutLabels ?? '{}');
  const lang = document.documentElement.lang.startsWith('fr') ? 'fr' : 'en';

  // Le module, et avec lui l'extrait de la fiche. Tant qu'il n'est pas là, la
  // page affiche déjà le premier cas, calculé à la construction du site.
  const spec = (await loader()).default;

  zone.dataset.enhanced = 'true';
  boutons.forEach((b) => b.removeAttribute('disabled'));

  const executer = (texte) => {
    let resultat;
    try {
      resultat = spec.run(texte, lang);
    } catch (erreur) {
      resultat = { error: labels.failed };
    }
    // Un essai peut être asynchrone ; le rendu attend alors sa promesse.
    Promise.resolve(resultat)
      .catch(() => ({ error: labels.failed }))
      .then((r) => {
        sortie.innerHTML = renderResult(r, texte, labels);
      });
  };

  /** Le mot sur ce qui casse ne s'affiche que pour le cas qui casse. */
  const direCeQuiCasse = (cas) => {
    if (!casses) return;
    const raison = cas && cas.fails ? bilingual(cas.why, lang) : '';
    if (texteCasse) texteCasse.textContent = raison ?? '';
    casses.hidden = !raison;
  };

  let attente;
  champ.addEventListener('input', () => {
    clearTimeout(attente);
    // Assez court pour suivre la frappe, assez long pour ne pas relancer le
    // code à chaque caractère.
    attente = setTimeout(() => {
      boutons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      const cas = spec.cases.find((c) => caseInput(c, lang) === champ.value);
      direCeQuiCasse(cas);
      executer(champ.value);
    }, 90);
  });

  boutons.forEach((bouton, i) => {
    bouton.addEventListener('click', () => {
      const cas = spec.cases[i];
      champ.value = caseInput(cas, lang);
      boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      direCeQuiCasse(cas);
      executer(champ.value);
    });
  });
}
