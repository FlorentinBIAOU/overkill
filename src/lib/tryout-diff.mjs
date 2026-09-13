/**
 * Le surlignage de la zone d'essai : ce que le code a attrapé, et ce qu'il a
 * laissé.
 *
 * On compare l'entrée et la sortie et on découpe les deux en segments, à la
 * manière de regex101 : ce qui disparaît de l'entrée est marqué d'un côté, ce
 * qui apparaît dans la sortie est marqué de l'autre. Le lecteur voit d'un coup
 * d'œil ce que la règle a touché, sans avoir à comparer deux paragraphes
 * caractère par caractère.
 *
 * La découpe est faite en jetons — mots, nombres, ponctuation, blancs — et non
 * en caractères : un surlignage qui coupe un numéro de téléphone au milieu ne
 * se lit pas. Le même module sert au rendu du site et au navigateur, pour que
 * les deux surlignent exactement pareil.
 */

/** Découpe en mots, nombres, blancs et signes, chaque signe restant seul. */
export function tokenise(text) {
  return text.match(/[\p{L}\p{N}_]+|\s+|[^\p{L}\p{N}_\s]/gu) ?? [];
}

/**
 * Plus longue sous-séquence commune, en table de longueurs.
 *
 * Les essais portent sur des textes courts — quelques centaines de caractères
 * au plus — donc la table quadratique tient largement. Au-delà d'un millier de
 * jetons de chaque côté, on renonce au surlignage fin plutôt que de faire
 * ramer le navigateur de quelqu'un : la sortie reste juste, elle est
 * simplement marquée d'un seul bloc.
 */
const MAX_TOKENS = 1200;

export function segments(before, after) {
  const a = tokenise(before);
  const b = tokenise(after);

  if (a.length > MAX_TOKENS || b.length > MAX_TOKENS) {
    return {
      before: [{ text: before, changed: before !== after }],
      after: [{ text: after, changed: before !== after }],
    };
  }

  // Les bords identiques se traitent sans table : c'est le cas courant, un
  // texte dont seul le milieu change.
  let debut = 0;
  while (debut < a.length && debut < b.length && a[debut] === b[debut]) debut++;
  let fin = 0;
  while (
    fin < a.length - debut &&
    fin < b.length - debut &&
    a[a.length - 1 - fin] === b[b.length - 1 - fin]
  ) {
    fin++;
  }

  const milieuA = a.slice(debut, a.length - fin);
  const milieuB = b.slice(debut, b.length - fin);

  const l = Array.from({ length: milieuA.length + 1 }, () =>
    new Uint16Array(milieuB.length + 1),
  );
  for (let i = milieuA.length - 1; i >= 0; i--) {
    for (let j = milieuB.length - 1; j >= 0; j--) {
      l[i][j] =
        milieuA[i] === milieuB[j]
          ? l[i + 1][j + 1] + 1
          : Math.max(l[i + 1][j], l[i][j + 1]);
    }
  }

  const avant = [];
  const apres = [];
  const pousser = (liste, texte, changed) => {
    const dernier = liste[liste.length - 1];
    if (dernier && dernier.changed === changed) dernier.text += texte;
    else liste.push({ text: texte, changed });
  };

  for (const jeton of a.slice(0, debut)) {
    pousser(avant, jeton, false);
    pousser(apres, jeton, false);
  }

  let i = 0;
  let j = 0;
  while (i < milieuA.length && j < milieuB.length) {
    if (milieuA[i] === milieuB[j]) {
      pousser(avant, milieuA[i], false);
      pousser(apres, milieuB[j], false);
      i++;
      j++;
    } else if (l[i + 1][j] >= l[i][j + 1]) {
      pousser(avant, milieuA[i], true);
      i++;
    } else {
      pousser(apres, milieuB[j], true);
      j++;
    }
  }
  for (; i < milieuA.length; i++) pousser(avant, milieuA[i], true);
  for (; j < milieuB.length; j++) pousser(apres, milieuB[j], true);

  for (const jeton of a.slice(a.length - fin)) {
    pousser(avant, jeton, false);
    pousser(apres, jeton, false);
  }

  return { before: avant, after: apres };
}

/**
 * Segments d'un texte à partir de positions explicites, quand l'essai sait
 * lui-même ce qu'il a attrapé et n'a pas besoin d'être deviné.
 */
export function fromSpans(text, spans) {
  const ordonnes = [...spans].sort((x, y) => x.start - y.start);
  const out = [];
  let curseur = 0;
  for (const { start, end, label } of ordonnes) {
    if (start < curseur || start > text.length) continue;
    if (start > curseur) out.push({ text: text.slice(curseur, start), changed: false });
    out.push({ text: text.slice(start, end), changed: true, label });
    curseur = end;
  }
  if (curseur < text.length) out.push({ text: text.slice(curseur), changed: false });
  return out;
}
