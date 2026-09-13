/**
 * Onglets de code et bouton copier.
 *
 * Écrit en JavaScript natif, sans cadre d'interface (CDC 10.1). Chargé
 * uniquement sur les pages qui en ont besoin.
 *
 * Le HTML est complet avant que ce module ne s'exécute : les deux panneaux
 * sont rendus, et les deux blocs de code sont lisibles. Ce module ne fait
 * qu'ajouter le confort des onglets, et se déclare par `data-enhanced` pour
 * que le CSS sache qu'il peut masquer le panneau inactif.
 */

function setUpTabs(root) {
  const tabs = [...root.querySelectorAll('[role="tab"]')];
  const panels = [...root.querySelectorAll('[role="tabpanel"]')];
  if (tabs.length < 2) return;

  root.dataset.enhanced = 'true';

  const select = (index, { focus = false } = {}) => {
    tabs.forEach((tab, i) => {
      const selected = i === index;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      panels[i].hidden = !selected;
    });
    if (focus) tabs[index].focus();
  };

  select(tabs.findIndex((t) => t.getAttribute('aria-selected') === 'true') || 0);

  tabs.forEach((tab, i) => {
    tab.addEventListener('click', () => select(i));
    tab.addEventListener('keydown', (event) => {
      const moves = {
        ArrowLeft: i - 1,
        ArrowRight: i + 1,
        Home: 0,
        End: tabs.length - 1,
      };
      const next = moves[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select((next + tabs.length) % tabs.length, { focus: true });
    });
  });
}

function setUpCopy(button) {
  // Le code est lu dans le bloc rendu, et non dans un champ caché en double.
  // Un champ caché aurait été focalisable au clavier tout en étant masqué aux
  // lecteurs d'écran, ce que l'audit d'accessibilité refuse à juste titre, et
  // il aurait pesé une seconde copie du code dans le HTML.
  const source = button.closest('figure')?.querySelector('pre');
  if (!source) return;

  const status = document.createElement('span');
  status.className = 'visually-hidden';
  // Le changement d'état est annoncé aux lecteurs d'écran, pas seulement
  // montré sur le bouton.
  status.setAttribute('role', 'status');
  button.after(status);

  let restore;
  button.addEventListener('click', async () => {
    clearTimeout(restore);
    let label;
    try {
      await navigator.clipboard.writeText(source.textContent);
      label = button.dataset.labelCopied;
    } catch {
      label = button.dataset.labelFailed;
    }
    button.textContent = label;
    status.textContent = label;
    restore = setTimeout(() => {
      button.textContent = button.dataset.labelCopy;
      status.textContent = '';
    }, 2000);
  });
}

/**
 * Un lien vers un niveau replié doit ouvrir le repli.
 *
 * Le sommaire et les liens « voir le niveau au-dessus » pointent vers des
 * sections rangées dans un <details> fermé. Sans cela, le navigateur saute à
 * un endroit où il n'y a rien à voir.
 */
function openTarget(hash) {
  if (!hash || hash.length < 2) return;
  const cible = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!cible) return;
  for (let n = cible.closest('details'); n; n = n.parentElement?.closest('details')) {
    n.open = true;
  }
  cible.scrollIntoView({ block: 'start' });
}

document.addEventListener('click', (event) => {
  const lien = event.target.closest?.('a[href^="#"]');
  if (!lien) return;
  const hash = lien.getAttribute('href');
  const cible = document.getElementById(decodeURIComponent(hash.slice(1)));
  if (!cible?.closest('details')) return;
  event.preventDefault();
  history.pushState(null, '', hash);
  openTarget(hash);
});

window.addEventListener('hashchange', () => openTarget(location.hash));
openTarget(location.hash);

document.querySelectorAll('[data-code-tabs]').forEach(setUpTabs);
document.querySelectorAll('[data-copy]').forEach(setUpCopy);
