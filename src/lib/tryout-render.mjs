/**
 * Le rendu du résultat d'un essai, en HTML.
 *
 * Un seul module, employé à la construction du site et dans le navigateur :
 * la zone d'essai affiche exactement la même chose avec et sans JavaScript,
 * et il n'existe qu'un endroit à corriger quand le rendu change.
 *
 * Tout ce qui vient de la saisie ou d'un extrait passe par `escape` : le
 * résultat contient du texte que la personne a tapé, il ne peut jamais devenir
 * du balisage.
 */
import { segments, fromSpans } from './tryout-diff.mjs';

export function escape(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

/** Une suite de segments, les changés surlignés. */
function renderSegments(parts) {
  return parts
    .map((p) =>
      p.changed
        ? `<mark class="tryout__mark"${p.label ? ` data-label="${escape(p.label)}"` : ''}>${escape(p.text)}</mark>`
        : escape(p.text),
    )
    .join('');
}

function renderRows(table) {
  const head = table.columns
    .map((c) => `<th scope="col">${escape(c)}</th>`)
    .join('');
  const body = table.rows
    .map((row) => {
      /* Une ligne dont une cellule est attrapée se voit entière : le petit
         aplat jaune d'une cellule perdue au milieu d'un tableau de six
         colonnes ne se remarque pas, et c'est précisément ce qu'on vient
         voir. */
      const retenue = row.some((cell) => cell && typeof cell === 'object' && cell.caught);
      const cells = row
        .map((cell) => {
          const value = cell && typeof cell === 'object' ? cell.v : cell;
          const caught = Boolean(cell && typeof cell === 'object' && cell.caught);
          const contenu = caught
            ? `<mark class="tryout__mark">${escape(value)}</mark>`
            : escape(value ?? '');
          return `<td>${contenu}</td>`;
        })
        .join('');
      return `<tr${retenue ? ' class="tryout__row--caught"' : ''}>${cells}</tr>`;
    })
    .join('');
  return `<div class="tryout__table scroll-x"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/**
 * Le compte des passages surlignés, tel que regex101 l'affiche au-dessus de
 * son champ. Il ne se dit que lorsque le texte donné est rendu surligné :
 * là, « attrapé » se compte sans interprétation — c'est le nombre de morceaux
 * du texte que le code a touchés. Ailleurs — un verdict, une image, un
 * tableau dont une cellule porte le signal décisif — le mot n'aurait pas le
 * même sens, et on ne le dit pas.
 */
function renderSummary(entree, labels) {
  const n = entree ? entree.filter((p) => p.changed).length : 0;
  const texte =
    n === 0
      ? labels.matchNone
      : n === 1
        ? labels.matchOne
        : String(labels.matchMany ?? '').replace('{n}', String(n));
  return (
    `<p class="tryout__summary" data-caught="${n > 0}">` +
    `<span class="tryout__summary-dot" aria-hidden="true"></span>${escape(texte)}</p>`
  );
}

/**
 * @param {object} result  ce que la fonction d'essai a renvoyé
 * @param {string} input   la saisie, pour le surlignage de l'entrée
 * @param {object} labels  les intitulés, déjà dans la langue de la page
 * @param {object} options `alwaysShowInput` rend le panneau d'entrée même
 *   quand rien n'a été attrapé. La forme figée en a besoin — le champ de
 *   saisie n'est pas là pour montrer l'entrée — la forme interactive non.
 *   `displayInput` remplace le texte affiché quand l'entrée réelle ne
 *   s'affiche pas : un document de quarante mille caractères se décrit, il ne
 *   se lit pas.
 *   `notice` pose une phrase au-dessus du résultat : elle sert à dire que ce
 *   qui est montré n'est pas ce qui est dans le champ — le champ vidé, qui
 *   remontre l'exemple de départ.
 */
export function renderResult(result, input, labels, options = {}) {
  const avis = options.notice
    ? `<p class="tryout__notice">${escape(options.notice)}</p>`
    : '';

  if (result?.error) {
    return `${avis}<p class="tryout__error">${escape(result.error)}</p>`;
  }

  const morceaux = [];

  /* L'entrée annotée : ce que le code a repéré dans le texte donné, et ce
     qu'il a laissé. Un essai qui déclare des positions montre son texte même
     quand il n'en a retenu aucune — « rien attrapé » est un résultat, et
     c'est le plus instructif des deux. */
  const declare = Array.isArray(result?.spans);
  let entree = null;
  if (declare) {
    entree = fromSpans(input, result.spans);
  } else if (result?.diff && typeof result.output === 'string') {
    entree = segments(input, result.output).before;
  }
  const attrape = Boolean(entree && entree.some((p) => p.changed));
  if (attrape) {
    morceaux.push(
      `<div class="tryout__pane"><p class="tryout__pane-label">${escape(labels.caught)}</p>` +
        `<p class="tryout__text">${renderSegments(entree)}</p></div>`,
    );
  } else if (declare || options.alwaysShowInput) {
    morceaux.push(
      `<div class="tryout__pane"><p class="tryout__pane-label">${escape(labels.given)}</p>` +
        `<p class="tryout__text">${escape(options.displayInput ?? input)}</p></div>`,
    );
  }

  /* Un même résultat peut porter plusieurs panneaux — ce que le code renvoie,
     ce qu'il en conclut, le détail chiffré — et chacun porte alors son propre
     intitulé. Deux panneaux voisins intitulés « ce qu'il renvoie » ne
     s'expliquent pas l'un l'autre. */
  let premier = true;
  const marque = () => {
    const seul = premier;
    premier = false;
    return seul;
  };

  if (typeof result?.output === 'string') {
    const sortie = result.diff
      ? renderSegments(segments(input, result.output).after)
      : escape(result.output);
    morceaux.push(
      `<div class="tryout__pane"><p class="tryout__pane-label">${escape((marque(), labels.output))}</p>` +
        `<p class="tryout__text tryout__text--out">${sortie || `<span class="tryout__void">${escape(labels.empty)}</span>`}</p></div>`,
    );
  }

  if (result?.verdict) {
    morceaux.push(
      `<div class="tryout__pane"><p class="tryout__pane-label">${escape(marque() ? labels.output : labels.conclusion)}</p>` +
        `<p class="tryout__verdict">${escape(result.verdict.label)}</p>` +
        (result.verdict.detail
          ? `<p class="tryout__detail">${escape(result.verdict.detail)}</p>`
          : '') +
        `</div>`,
    );
  }

  if (result?.rows) {
    /* Un tableau de trois colonnes ou plus prend la largeur entière : serré
       dans une demi-colonne, il perdait sa dernière colonne derrière un
       défilement que personne ne remarque. */
    const large = (result.rows.columns?.length ?? 0) >= 3 ? ' tryout__pane--wide' : '';
    morceaux.push(
      `<div class="tryout__pane${large}"><p class="tryout__pane-label">${escape(marque() ? labels.output : labels.detail)}</p>` +
        renderRows(result.rows) +
        `</div>`,
    );
  }

  /* Une image produite par le code est posée en URI de données dans une
     balise <img> et non injectée comme balisage : un SVG en <img> ne peut
     rien exécuter, même construit à partir d'un texte tapé par la personne. */
  if (result?.image) {
    const uri = `data:image/svg+xml,${encodeURIComponent(result.image.svg)}`;
    morceaux.push(
      `<div class="tryout__pane"><p class="tryout__pane-label">${escape(marque() ? labels.output : labels.image)}</p>` +
        `<img class="tryout__image" src="${uri}" alt="${escape(result.image.alt)}" width="160" height="160"></div>`,
    );
  }

  if (result?.note) {
    morceaux.push(`<p class="tryout__note">${escape(result.note)}</p>`);
  }

  /* Le compte ne s'affiche que là où il se compte : quand le texte donné est
     rendu surligné, c'est-à-dire quand l'essai sait dire ce qu'il a touché. */
  const compte = entree ? renderSummary(entree, labels) : '';

  return `${avis}${compte}<div class="tryout__panes">${morceaux.join('')}</div>`;
}
