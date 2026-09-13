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
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<div class="tryout__table scroll-x"><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
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
 */
export function renderResult(result, input, labels, options = {}) {
  if (result?.error) {
    return `<p class="tryout__error">${escape(result.error)}</p>`;
  }

  const morceaux = [];

  /* L'entrée annotée : ce que le code a repéré dans le texte donné. Elle
     n'apparaît que s'il y a quelque chose à montrer, jamais pour répéter la
     saisie telle quelle. */
  let entree = null;
  if (Array.isArray(result?.spans) && result.spans.length > 0) {
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
  } else if (options.alwaysShowInput) {
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

  return morceaux.join('');
}
