/**
 * Le questionnaire d'orientation, côté navigateur.
 *
 * Le HTML porte déjà les quatre écrans et toutes les options : ce module ne
 * fait que masquer ce qui n'est pas demandé, compter ce qui reste, et calculer
 * le verdict. Le calcul est celui de src/lib/guide-verdict.mjs, le même que
 * celui que le contrôle automatique exécute sur tous les parcours.
 *
 * Aucun appel réseau, aucun modèle : les réponses ne quittent pas la page.
 */
import { computeVerdict, NSP } from '../lib/guide-verdict.mjs';
import { escape } from '../lib/tryout-render.mjs';

const racine = document.querySelector('[data-guide]');
if (racine) mettreEnPlace(racine);

function mettreEnPlace(racine) {
  const brut = document.querySelector('[data-guide-payload]');
  if (!brut) return;
  const charge = JSON.parse(brut.textContent);
  const S = charge.strings;

  const formulaire = racine.querySelector('[data-guide-form]');
  const ecrans = [...racine.querySelectorAll('[data-screen]')];
  const progres = racine.querySelector('[data-guide-progress]');
  const erreur = racine.querySelector('[data-guide-error]');
  const suivant = racine.querySelector('[data-guide-next]');
  const retour = racine.querySelector('[data-guide-back]');
  const sortie = racine.querySelector('[data-guide-verdict]');
  const reprise = racine.querySelector('[data-guide-restart]');
  const gabarit = document.querySelector('[data-guide-cards]');

  racine.dataset.enhanced = 'true';
  let courant = 0;

  const reponses = () => {
    const out = {};
    for (const champ of formulaire.querySelectorAll('input[type="radio"]:checked')) {
      out[champ.name] = champ.value;
    }
    return out;
  };

  /**
   * Les questions qui seront posées, dans l'ordre.
   *
   * Tant que la famille n'est pas choisie, la question sur la tâche compte :
   * elle est encore à venir. Elle ne disparaît du compte que si la personne
   * répond qu'elle ne sait pas encore ce qu'elle veut faire, auquel cas il n'y
   * a pas de liste de tâches à lui montrer.
   */
  const questionsVisibles = () => {
    const etat = reponses();
    return [...formulaire.querySelectorAll('[data-question]')].filter((q) =>
      q.dataset.question === 'entry' ? etat.family !== NSP : true,
    );
  };

  /**
   * La question sur la tâche n'affiche que les tâches de la famille choisie.
   * C'est le seul endroit où l'arbre se resserre, et il se resserre sur les
   * données des fiches.
   */
  const ajusterTaches = () => {
    const etat = reponses();
    const bloc = formulaire.querySelector('[data-question="entry"]');
    if (!bloc) return;
    const inutile = !etat.family || etat.family === NSP;
    bloc.hidden = inutile;
    for (const item of bloc.querySelectorAll('li')) {
      const famille = item.dataset.family;
      const garder = !famille || famille === etat.family;
      item.hidden = !garder;
      if (!garder) {
        const champ = item.querySelector('input');
        if (champ) champ.checked = false;
      }
    }
  };

  const afficher = (index) => {
    courant = index;
    ajusterTaches();
    ecrans.forEach((e, i) => {
      e.hidden = i !== index;
    });
    retour.hidden = index === 0;
    suivant.textContent = index === ecrans.length - 1 ? S.finish : S.next;
    erreur.hidden = true;
    majProgres();
    /* Le titre de l'écran reprend le focus : au clavier comme au lecteur
       d'écran, on sait qu'on a changé de page sans changer d'adresse. */
    const titre = ecrans[index].querySelector('.guide__screen-title');
    if (titre) {
      titre.setAttribute('tabindex', '-1');
      titre.focus({ preventScroll: true });
      titre.scrollIntoView({ block: 'start' });
    }
  };

  const majProgres = () => {
    const visibles = questionsVisibles();
    const repondues = visibles.filter((q) =>
      q.querySelector('input:checked'),
    ).length;
    const reste = Math.max(visibles.length - repondues, 0);
    const gabaritTexte = reste === 1 ? S.remainingOne : S.remaining;
    progres.textContent =
      `${S.step.replace('{n}', String(courant + 1)).replace('{total}', String(ecrans.length))} · ` +
      gabaritTexte.replace('{n}', String(reste));
  };

  formulaire.addEventListener('change', () => {
    ajusterTaches();
    majProgres();
    erreur.hidden = true;
  });

  suivant.addEventListener('click', () => {
    const manquantes = [...ecrans[courant].querySelectorAll('[data-question]')].filter(
      (q) => !q.hidden && !q.querySelector('input:checked'),
    );
    if (manquantes.length > 0) {
      erreur.textContent = S.required;
      erreur.hidden = false;
      manquantes[0].querySelector('input')?.focus();
      return;
    }
    if (courant < ecrans.length - 1) {
      afficher(courant + 1);
    } else {
      rendreVerdict();
    }
  });

  retour.addEventListener('click', () => afficher(Math.max(courant - 1, 0)));

  reprise.querySelector('button').addEventListener('click', () => {
    formulaire.reset();
    formulaire.hidden = false;
    sortie.hidden = true;
    sortie.replaceChildren(sortie.querySelector('h2'));
    reprise.hidden = true;
    afficher(0);
  });

  afficher(0);

  // ---------------------------------------------------------------- verdict

  function rendreVerdict() {
    const etat = reponses();
    if (etat.entry === 'aucune' || etat.family === NSP) delete etat.entry;
    const v = computeVerdict(etat, charge.data);

    formulaire.hidden = true;
    reprise.hidden = false;
    const html = v.kind === 'fiche' ? verdictFiche(v) : verdictSansFiche(v, etat);
    sortie.hidden = false;
    sortie.insertAdjacentHTML('beforeend', html);
    poserCartes(v);
    const titre = sortie.querySelector('.gv__answer, .gv__gap-title');
    if (titre) {
      titre.setAttribute('tabindex', '-1');
      titre.focus({ preventScroll: true });
      titre.scrollIntoView({ block: 'start' });
    }
  }

  const T = (gabarit, valeurs) =>
    Object.entries(valeurs).reduce(
      (out, [cle, valeur]) => out.replaceAll(`{${cle}}`, escape(String(valeur ?? ''))),
      escape(gabarit),
    );

  /** Les constatations de la ligne « ce que vous avez demandé tient ». */
  const LISTE = {
    egress: (n) => S.plainEgress[n.egress] ?? n.egress,
    meme: (n) => S.riskPlain.deterministic[String(n.deterministic)],
    verifier: (n) => S.riskPlain.testability[n.testability],
  };

  function noteTexte(note) {
    const V = S.verdict.notes[note.cle];
    if (!V) return '';
    return T(V, {
      liste: (note.demandes ?? []).map((c) => LISTE[c](note)).join(', '),
      de: note.de,
      vers: note.vers,
      nom: note.nom,
      niveau: note.niveau,
      sortie: note.egress ? (S.plainEgress[note.egress] ?? note.egress) : '',
      determinisme:
        note.deterministic === undefined
          ? ''
          : S.riskPlain.deterministic[String(note.deterministic)],
      verifiabilite: note.testability ? S.riskPlain.testability[note.testability] : '',
    });
  }

  function notes(liste) {
    if (liste.length === 0) return '';
    const items = liste
      .map((n) => {
        const grave = /SansIssue|Manquants|Impossible/.test(n.cle);
        return `<li class="gv__note${grave ? ' gv__note--warn' : ''}">${noteTexte(n)}</li>`;
      })
      .join('');
    return (
      `<div class="gv__section"><p class="gv__title">${escape(S.verdict.changesTitle)}</p>` +
      `<ul class="gv__notes">${items}</ul></div>`
    );
  }

  function verdictFiche(v) {
    const niveau = v.niveau.toLowerCase();
    const morceaux = [
      `<p class="gv__answer gv__answer--${niveau}">${escape(S.answer[v.niveau])}</p>`,
      `<p class="gv__approach">${T(S.verdict.forThisTask, { nom: v.nom })}</p>`,
    ];
    if (v.deplace) {
      morceaux.push(
        `<p class="gv__approach">${T(S.verdict.moved, { de: v.defaut })}</p>`,
      );
    }
    if (v.conflit) {
      morceaux.push(`<p class="gv__approach">${escape(S.verdict.conflict)}</p>`);
    }
    /* La justification de la fiche argumente le niveau que la fiche
       recommande. Quand les contraintes ont déplacé la réponse, la présenter
       comme « pourquoi » se contredirait : elle est alors étiquetée pour ce
       qu'elle est. */
    const titreWhy = v.deplace
      ? T(S.verdict.whyDefaultTitle, { de: v.defaut })
      : escape(S.verdict.whyTitle);
    morceaux.push(
      `<div class="gv__section"><p class="gv__title">${titreWhy}</p>` +
        `<p class="gv__why">${escape(v.entry.rationale)}</p></div>`,
    );
    morceaux.push(notes(v.notes));
    morceaux.push(
      `<div class="gv__section"><p class="gv__title">${escape(S.verdict.entryTitle)}</p>` +
        `<div data-cards="${escape(v.entry.id)}"></div></div>`,
    );
    if (v.voisines.length > 0) {
      morceaux.push(
        `<div class="gv__section"><p class="gv__title">${escape(S.verdict.neighboursTitle)}</p>` +
          `<div data-cards="${escape(v.voisines.map((e) => e.id).join(' '))}"></div></div>`,
      );
    }
    return morceaux.join('');
  }

  function verdictSansFiche(v, etat) {
    const gap = v.kind === 'familleSansFiche';
    const morceaux = [
      `<p class="gv__answer gv__gap-title">${escape(gap ? S.verdict.gapHeading : S.verdict.noTaskHeading)}</p>`,
      `<p class="gv__approach">${escape(gap ? S.verdict.gapBody : S.verdict.noTaskBody)}</p>`,
      notes(v.notes),
      `<div class="gv__section"><div class="gv__routes">` +
        route(S.verdict.mailAction, lienMail(etat), S.verdict.mailHelp) +
        route(S.verdict.issueAction, charge.links.issue, S.verdict.issueHelp, true) +
        `</div></div>`,
      `<div class="gv__section"><p class="gv__actions">` +
        `<a class="link-action" href="${escape(charge.links.catalogue + v.filtres)}">${escape(S.verdict.browseAction)}</a>` +
        `</p></div>`,
    ];
    if (gap && v.entries.length > 0) {
      morceaux.push(
        `<div class="gv__section"><p class="gv__title">${escape(S.verdict.familyAction)}</p>` +
          `<div data-cards="${escape(v.entries.map((e) => e.id).join(' '))}"></div></div>`,
      );
    }
    return morceaux.join('');
  }

  function route(label, href, aide, externe = false) {
    return (
      `<div class="gv__route"><a class="button" href="${escape(href)}"${externe ? ' rel="noopener"' : ''}>` +
      `${escape(label)}</a><p class="gv__route-help">${escape(aide)}</p></div>`
    );
  }

  /** Le message pré-rempli : le besoin, et ce que la personne a répondu. */
  function lienMail(etat) {
    const lignes = [S.verdict.mailIntro, ''];
    for (const bloc of questionsVisibles()) {
      const choisi = bloc.querySelector('input:checked');
      if (!choisi) continue;
      const question = bloc.querySelector('.q__label')?.textContent?.trim();
      const reponse = choisi
        .closest('label')
        ?.querySelector('.q__option-label')
        ?.textContent?.trim();
      lignes.push(`- ${question} ${reponse}`);
    }
    lignes.push('', '');
    const adresse = `${charge.mail.user}@${charge.mail.domain}`;
    /* Encodage à la main, et non par URLSearchParams : celui-ci écrit les
       espaces en « + », ce qu'un mailto n'interprète pas — le brouillon
       s'ouvrirait avec des plus à la place des espaces. */
    const champ = (valeur) => encodeURIComponent(valeur).replaceAll('%0A', '%0D%0A');
    return (
      `mailto:${adresse}?subject=${champ(S.verdict.mailSubject)}` +
      `&body=${champ(lignes.join('\n'))}`
    );
  }

  /** Clone les cartes demandées depuis le gabarit rendu par le site. */
  function poserCartes(v) {
    if (!gabarit) return;
    for (const cible of sortie.querySelectorAll('[data-cards]')) {
      const liste = document.createElement('ul');
      liste.className = 'guide__cards';
      for (const id of cible.dataset.cards.split(' ').filter(Boolean)) {
        const source = gabarit.content.querySelector(`[data-card-id="${id}"] > li`);
        if (source) liste.append(source.cloneNode(true));
      }
      cible.replaceWith(liste);
    }
  }
}
