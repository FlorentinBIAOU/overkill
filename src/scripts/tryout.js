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

/** Le temps pendant lequel la ligne d'état dit « recalculé ». */
const DUREE_ETAT = 1500;

const zone = document.querySelector('[data-tryout]');
if (zone) setUp(zone);

async function setUp(zone) {
  const loader = MODULES[`../../content/tryouts/live/${zone.dataset.tryout}.js`];
  if (!loader) return;

  const champ = zone.querySelector('[data-tryout-input]');
  const panneau = zone.querySelector('[data-tryout-panel]');
  const sortie = zone.querySelector('[data-tryout-result]');
  const casses = zone.querySelector('[data-tryout-why]');
  const texteCasse = zone.querySelector('[data-tryout-why-text]');
  const etat = zone.querySelector('[data-tryout-status]');
  const lanceur = zone.querySelector('[data-tryout-run]');
  const boutons = [...zone.querySelectorAll('[data-tryout-case]')];
  if (!champ || !sortie) return;

  const labels = JSON.parse(zone.dataset.tryoutLabels ?? '{}');
  const lang = document.documentElement.lang.startsWith('fr') ? 'fr' : 'en';

  // Le module, et avec lui l'extrait de la fiche. Tant qu'il n'est pas là, la
  // page affiche déjà le premier cas, calculé à la construction du site.
  const spec = (await loader()).default;

  zone.dataset.enhanced = 'true';
  boutons.forEach((b) => b.removeAttribute('disabled'));
  if (lanceur) lanceur.removeAttribute('disabled');

  /* L'exemple de départ, gardé de côté : c'est ce que la zone montre en
     arrivant, et ce vers quoi elle revient quand on vide le champ. */
  const casDepart = spec.cases[0];
  const texteDepart = caseInput(casDepart, lang);

  /** Le panneau bat une fois, et la ligne d'état dit que ça vient d'avoir
   *  lieu. C'est le seul signe visible quand le résultat ne change pas d'un
   *  caractère — un espace ajouté à la fin, le bouton pressé deux fois. */
  let retour;
  const signaler = () => {
    if (panneau) {
      panneau.removeAttribute('data-flash');
      // Forcer le recalcul du style, sans quoi retirer et reposer l'attribut
      // dans la même image ne relance pas l'animation.
      void panneau.offsetWidth;
      panneau.dataset.flash = 'true';
    }
    if (!etat) return;
    etat.textContent = labels.ran ?? '';
    etat.dataset.justRan = 'true';
    clearTimeout(retour);
    retour = setTimeout(() => {
      etat.textContent = labels.liveHint ?? '';
      etat.dataset.justRan = 'false';
    }, DUREE_ETAT);
  };

  const rendre = (resultat, texte, options) => {
    sortie.innerHTML = renderResult(resultat, texte, labels, options);
    signaler();
  };

  const executer = (texte, options) => {
    let resultat;
    try {
      resultat = spec.run(texte, lang);
    } catch (erreur) {
      resultat = { error: labels.failed };
    }
    // Un essai peut être asynchrone ; le rendu attend alors sa promesse.
    Promise.resolve(resultat)
      .catch(() => ({ error: labels.failed }))
      .then((r) => rendre(r, texte, options));
  };

  /** Le mot sur ce qui casse ne s'affiche que pour le cas qui casse. */
  const direCeQuiCasse = (cas) => {
    if (!casses) return;
    const raison = cas && cas.fails ? bilingual(cas.why, lang) : '';
    if (texteCasse) texteCasse.textContent = raison ?? '';
    casses.hidden = !raison;
  };

  /**
   * Un champ vidé n'est pas une erreur, c'est un champ vidé.
   *
   * Il donnait un message d'échec sur les essais dont l'extrait n'a rien à
   * lire dans une chaîne vide. La zone revient désormais à ce qu'elle montrait
   * en arrivant : l'exemple de départ, son résultat, son exemple sélectionné,
   * et une phrase qui dit que ce qui est montré n'est pas ce qui est dans le
   * champ. Le texte de l'exemple n'est pas réécrit dans le champ : quelqu'un
   * qui efface tout pour écrire le sien ne se fait pas remplir le champ sous
   * les doigts.
   */
  const revenirAuDepart = () => {
    boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(j === 0)));
    direCeQuiCasse(casDepart);
    executer(texteDepart, { notice: labels.emptyReset });
  };

  const lancer = () => {
    if (champ.value.trim() === '') {
      revenirAuDepart();
      return;
    }
    const cas = spec.cases.find((c) => caseInput(c, lang) === champ.value);
    direCeQuiCasse(cas);
    executer(champ.value);
  };

  let attente;
  champ.addEventListener('input', () => {
    clearTimeout(attente);
    // Assez court pour suivre la frappe, assez long pour ne pas relancer le
    // code à chaque caractère.
    attente = setTimeout(() => {
      boutons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
      lancer();
    }, 90);
  });

  /* Le bouton ne fait rien que la frappe ne fasse déjà. Il est là pour qu'on
     sache qu'il y a quelque chose à lancer, et pour que le résultat réponde à
     un geste au lieu d'apparaître tout seul. */
  if (lanceur) {
    lanceur.addEventListener('click', () => {
      clearTimeout(attente);
      lancer();
    });
  }

  boutons.forEach((bouton, i) => {
    bouton.addEventListener('click', () => {
      const cas = spec.cases[i];
      champ.value = caseInput(cas, lang);
      boutons.forEach((b, j) => b.setAttribute('aria-pressed', String(i === j)));
      direCeQuiCasse(cas);
      clearTimeout(attente);
      executer(champ.value);
    });
  });
}
