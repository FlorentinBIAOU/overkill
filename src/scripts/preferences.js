/**
 * Préférences de l'utilisateur : thème et langue.
 *
 * Rien n'est écrit en stockage local avant un choix explicite (CDC 9.3).
 * Aucune détection, aucun identifiant, aucune mesure. Le stockage sert à se
 * souvenir d'un clic, et à rien d'autre.
 */

const CLE_THEME = 'overkill-theme';
const CLE_LANGUE = 'overkill-lang';

function themeCourant() {
  return (
    document.documentElement.dataset.theme ??
    (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')
  );
}

const bascule = document.querySelector('[data-theme-toggle]');

/**
 * Le libellé annonce l'action à venir, pas l'état courant : « passer au thème
 * sombre » se comprend seul, « thème clair, activé » demande de deviner ce que
 * fait le clic.
 */
function majEtiquette() {
  const etiquette = bascule?.querySelector('[data-theme-label]');
  if (!etiquette) return;
  const { labelToDark, labelToLight } = bascule.dataset;
  etiquette.textContent = themeCourant() === 'dark' ? labelToLight : labelToDark;
}

majEtiquette();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change', majEtiquette);

bascule?.addEventListener('click', () => {
  const suivant = themeCourant() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = suivant;
  majEtiquette();
  try {
    localStorage.setItem(CLE_THEME, suivant);
  } catch {
    // Navigation privée, ou stockage refusé. Le thème s'applique quand même
    // pour la page courante, il ne sera simplement pas mémorisé.
  }
});

document.querySelector('[data-lang-choice]')?.addEventListener('click', (event) => {
  try {
    localStorage.setItem(CLE_LANGUE, event.currentTarget.dataset.langChoice);
  } catch {
    // Idem : la navigation fonctionne, la préférence n'est pas retenue.
  }
});
