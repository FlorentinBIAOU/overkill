/**
 * Recherche et filtres du catalogue.
 *
 * Écrit en JavaScript natif, sans cadre d'interface (CDC 10.1). Il n'ajoute
 * rien à ce que la page sait déjà faire : la liste complète est rendue au
 * build, le formulaire de filtres se soumet en GET, et tout fonctionne sans
 * ce fichier. Ce module rend simplement le filtrage instantané et sans
 * rechargement.
 *
 * L'index de recherche n'est chargé qu'au premier caractère tapé : quelqu'un
 * qui vient consulter la liste ne paie pas pour une recherche qu'il ne fait
 * pas.
 */

const form = document.querySelector('[data-catalogue-form]');
const liste = document.querySelector('[data-entry-list]');
if (form && liste) initialiser(form, liste);

function initialiser(form, liste) {
  form.dataset.enhanced = 'true';

  const lignes = [...liste.querySelectorAll('[data-entry]')];
  const champ = form.querySelector('[data-search-input]');
  const selects = [...form.querySelectorAll('[data-filter]')];
  const compteur = document.querySelector('[data-count]');
  const etatVide = document.querySelector('[data-empty-state]');
  const lienVide = document.querySelector('[data-empty-action]');
  const indexUrl = form.dataset.searchIndex;

  /** Identifiants correspondant à la recherche, ou null si aucune recherche. */
  let correspondances = null;
  let index = null;
  let chargement = null;

  const normalise = (texte) =>
    texte.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

  /**
   * Distance d'édition, arrêtée dès qu'elle dépasse la limite.
   *
   * C'est ce qui donne la tolérance aux fautes légères demandée par la section
   * 9.1, sans embarquer de bibliothèque : vingt lignes suffisent.
   */
  function proche(a, b, limite = 1) {
    if (Math.abs(a.length - b.length) > limite) return false;
    let precedente = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i += 1) {
      const courante = [i];
      let minimum = i;
      for (let j = 1; j <= b.length; j += 1) {
        const cout = a[i - 1] === b[j - 1] ? 0 : 1;
        courante[j] = Math.min(
          precedente[j] + 1,
          courante[j - 1] + 1,
          precedente[j - 1] + cout,
        );
        minimum = Math.min(minimum, courante[j]);
      }
      if (minimum > limite) return false;
      precedente = courante;
    }
    return precedente[b.length] <= limite;
  }

  /** Un terme correspond s'il est contenu tel quel, ou à une faute près. */
  function termeTrouve(terme, texte, mots) {
    if (texte.includes(terme)) return true;
    if (terme.length < 4) return false;
    return mots.some((mot) => proche(terme, mot));
  }

  async function chargerIndex() {
    if (index) return index;
    if (!chargement) {
      chargement = fetch(indexUrl)
        .then((r) => r.json())
        .then((donnees) => {
          index = donnees.map((e) => ({ ...e, mots: e.t.split(' ') }));
          return index;
        })
        .catch(() => {
          // L'index est indisponible : la recherche ne filtre rien plutôt que
          // de vider la page. Les filtres, eux, continuent de fonctionner.
          index = [];
          return index;
        });
    }
    return chargement;
  }

  async function rechercher(requete) {
    const q = normalise(requete.trim());
    if (q.length < 2) {
      correspondances = null;
      return;
    }
    const donnees = await chargerIndex();
    const termes = q.split(/\s+/).filter(Boolean);
    correspondances = new Set(
      donnees
        .filter((e) => termes.every((t) => termeTrouve(t, e.t, e.mots)))
        .map((e) => e.i),
    );
  }

  function appliquer() {
    const actifs = Object.fromEntries(
      selects.filter((s) => s.value).map((s) => [s.dataset.filter, s.value]),
    );

    let visibles = 0;
    for (const ligne of lignes) {
      const passeFiltres = Object.entries(actifs).every(
        ([cle, valeur]) => ligne.dataset[cle] === valeur,
      );
      const passeRecherche = correspondances === null || correspondances.has(ligne.dataset.entryId);
      const visible = passeFiltres && passeRecherche;
      ligne.hidden = !visible;
      if (visible) visibles += 1;
    }

    if (compteur) compteur.textContent = String(visibles);
    if (etatVide) etatVide.hidden = visibles > 0;
    if (lienVide && champ?.value) {
      const base = lienVide.dataset.baseHref ?? lienVide.href;
      lienVide.dataset.baseHref = base;
      lienVide.href = `${base}&title=${encodeURIComponent(champ.value)}`;
    }

    majUrl(actifs);
  }

  /** L'état des filtres est reflété dans l'URL, pour être partageable (CDC 9.2). */
  function majUrl(actifs) {
    const params = new URLSearchParams();
    if (champ?.value.trim()) params.set('q', champ.value.trim());
    for (const [cle, valeur] of Object.entries(actifs)) params.set(cle, valeur);
    const requete = params.toString();
    history.replaceState(null, '', requete ? `?${requete}` : location.pathname);
  }

  /** Au chargement, on restitue l'état écrit dans l'URL. */
  async function restaurer() {
    const params = new URLSearchParams(location.search);
    for (const select of selects) {
      const valeur = params.get(select.dataset.filter);
      if (valeur !== null) select.value = valeur;
    }
    if (champ) {
      const q = params.get('q');
      if (q) champ.value = q;
      // Le focus au chargement, demandé par la section 7.3, mais seulement si
      // la page n'a pas déjà été défilée vers une ancre.
      if (!location.hash) champ.focus({ preventScroll: true });
    }
    await rechercher(champ?.value ?? '');
    appliquer();
  }

  let minuteur;
  champ?.addEventListener('input', () => {
    clearTimeout(minuteur);
    minuteur = setTimeout(async () => {
      await rechercher(champ.value);
      appliquer();
    }, 80);
  });

  for (const select of selects) select.addEventListener('change', appliquer);
  form.addEventListener('submit', (e) => e.preventDefault());

  restaurer();
}
