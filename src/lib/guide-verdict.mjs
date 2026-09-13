/**
 * Le verdict du questionnaire d'orientation (lot 14, partie 3).
 *
 * Fonction pure, sans i18n et sans DOM : elle prend les réponses et les
 * données des fiches, elle rend une structure. Les phrases sont assemblées par
 * la couche d'affichage à partir des clés qu'elle renvoie, et le même module
 * sert au navigateur et au contrôle automatique qui vérifie que tout parcours
 * aboutit.
 *
 * Aucun appel de modèle, aucun hasard : pour les mêmes réponses, le même
 * verdict. Un site qui prêche la sobriété ne met pas un LLM à son accueil.
 *
 * Rien n'est codé en dur sur les fiches. Les familles, les tâches, les
 * niveaux, la sortie de données et le déterminisme viennent des fiches
 * elles-mêmes : une fiche nouvelle devient atteignable sans toucher à ce
 * fichier.
 */

/** Les trois réponses possibles à une question fermée. */
export const OUI = 'oui';
export const NON = 'non';
export const NSP = 'nsp'; // « je ne sais pas », toujours disponible

const RANG = { N0: 0, N1: 1, N2: 2, N3: 3 };

/** Le niveau le plus frugal d'une liste. */
function leePlusFrugal(rungs) {
  return [...rungs].sort((a, b) => RANG[a.level] - RANG[b.level])[0];
}

/**
 * Les contraintes dures : celles qui écartent un niveau, et seulement quand la
 * personne a répondu. « Je ne sais pas » n'écarte rien — elle fait dire au
 * verdict ce que l'option implique, ce qui est précisément l'information qui
 * manquait pour répondre.
 */
const CONTRAINTES = [
  {
    cle: 'egress',
    // Les données ne peuvent pas sortir : un niveau qui les envoie chez un
    // tiers est écarté.
    exclut: (etat, rung) => etat.egress === NON && rung.risks.data_egress === 'third-party',
    note: 'egressBloque',
    noteSansIssue: 'egressSansIssue',
    noteInconnue: 'egressInconnu',
  },
  {
    cle: 'meme',
    exclut: (etat, rung) => etat.meme === OUI && rung.risks.deterministic !== true,
    note: 'memeBloque',
    noteSansIssue: 'memeSansIssue',
    noteInconnue: 'memeInconnu',
  },
  {
    cle: 'verifier',
    exclut: (etat, rung) => etat.verifier === OUI && rung.risks.testability === 'hard',
    note: 'verifierBloque',
    noteSansIssue: 'verifierSansIssue',
    noteInconnue: 'verifierInconnu',
  },
];

/**
 * @param {object} etat  les réponses : { family, entry, frequence, egress, meme,
 *   verifier, exemples, heberger }
 * @param {object} donnees  { entries, families }
 */
export function computeVerdict(etat, donnees) {
  const fiche = donnees.entries.find((e) => e.id === etat.entry);

  // Aucune tâche désignée : on ne prétend pas savoir laquelle. Le verdict
  // renvoie alors au catalogue, filtré par ce que la personne a dit de ses
  // contraintes, et propose les deux voies pour signaler le besoin manquant.
  if (!fiche) {
    const famille = donnees.families.find((f) => f.id === etat.family) ?? null;
    return {
      kind: famille ? 'familleSansFiche' : 'sansTache',
      family: famille,
      notes: notesDouces(etat, null),
      filtres: filtresCatalogue(etat, famille),
      entries: famille
        ? donnees.entries.filter((e) => e.family === famille.id)
        : [],
    };
  }

  const disponibles = fiche.rungs.filter((r) => r.available);
  const defaut = disponibles.find((r) => r.level === fiche.verdict) ?? disponibles[0];

  const eligibles = disponibles.filter(
    (r) => !CONTRAINTES.some((c) => c.exclut(etat, r)),
  );

  const notes = [];
  let retenu = defaut;
  let conflit = false;

  if (eligibles.some((r) => r.level === defaut.level)) {
    retenu = defaut;
  } else if (eligibles.length > 0) {
    retenu = leePlusFrugal(eligibles);
    // Dire laquelle des réponses a déplacé la recommandation, et où.
    for (const c of CONTRAINTES) {
      if (c.exclut(etat, defaut)) {
        notes.push({ cle: c.note, de: defaut.level, vers: retenu.level, nom: retenu.name });
      }
    }
  } else {
    // Aucun niveau documenté ne satisfait la contrainte. On le dit, et on ne
    // recommande rien d'autre que ce que la fiche recommande.
    conflit = true;
    retenu = defaut;
    for (const c of CONTRAINTES) {
      if (c.exclut(etat, defaut)) notes.push({ cle: c.noteSansIssue, de: defaut.level });
    }
  }

  // Ce que « je ne sais pas » vaut : la question reste posée, et le verdict
  // dit ce que l'option implique sur ce point précis.
  for (const c of CONTRAINTES) {
    if (etat[c.cle] === NSP) {
      notes.push({
        cle: c.noteInconnue,
        egress: retenu.risks.data_egress,
        deterministic: retenu.risks.deterministic,
        testability: retenu.risks.testability,
      });
    }
  }

  /*
   * Quand rien ne bloque, on le dit aussi. Sans cela, quelqu'un qui a répondu
   * à six questions de contrainte voyait un verdict qui n'en parlait pas, et
   * pouvait croire que ses réponses n'avaient servi à rien.
   */
  const demandes = CONTRAINTES.filter(
    (c) => etat[c.cle] === OUI || etat[c.cle] === NON,
  ).map((c) => c.cle);
  if (!conflit && !notes.some((n) => n.cle.endsWith('Bloque')) && demandes.length > 0) {
    notes.push({
      cle: 'contraintesSatisfaites',
      demandes,
      egress: retenu.risks.data_egress,
      deterministic: retenu.risks.deterministic,
      testability: retenu.risks.testability,
    });
  }

  notes.push(...notesDouces(etat, retenu));

  return {
    kind: 'fiche',
    entry: fiche,
    niveau: retenu.level,
    nom: retenu.name,
    deplace: retenu.level !== defaut.level,
    defaut: defaut.level,
    conflit,
    notes,
    voisines: donnees.entries
      .filter((e) => e.family === fiche.family && e.id !== fiche.id)
      .slice(0, 3),
  };
}

/**
 * Les remarques qui n'écartent aucun niveau mais changent ce qu'il faut savoir
 * avant de s'y mettre : de quoi on dispose, et à quelle échelle.
 */
function notesDouces(etat, retenu) {
  const notes = [];
  const niveau = retenu?.level;

  if (etat.exemples === 'aucun' && (niveau === 'N1' || niveau === 'N2')) {
    notes.push({ cle: 'exemplesManquants', niveau });
  }
  // L'inverse mérite d'être dit : c'est ce qui rend l'option la plus légère
  // si peu coûteuse.
  if ((etat.exemples === 'aucun' || etat.exemples === 'quelques') && niveau === 'N0') {
    notes.push({ cle: 'exemplesInutiles', niveau });
  }
  if (etat.exemples === 'quelques' && niveau === 'N1') {
    notes.push({ cle: 'exemplesPeu', niveau });
  }
  if (etat.heberger === NON && niveau === 'N2') {
    notes.push({ cle: 'hebergementImpossible', niveau });
  }
  if (etat.frequence === 'haute' && (niveau === 'N2' || niveau === 'N3')) {
    notes.push({ cle: 'frequenceHaute', niveau });
  }
  if (etat.frequence === 'basse' && niveau === 'N3') {
    notes.push({ cle: 'frequenceBasse', niveau });
  }
  return notes;
}

/**
 * Les filtres du catalogue qui traduisent les contraintes exprimées. C'est ce
 * qui rend le parcours utile même quand aucune tâche n'a été désignée : la
 * personne repart avec une liste réduite, pas avec un haussement d'épaules.
 */
function filtresCatalogue(etat, famille) {
  const params = new URLSearchParams();
  if (famille) params.set('family', famille.id);
  if (etat.egress === NON) params.set('egress', 'none');
  if (etat.meme === OUI) params.set('deterministic', 'true');
  const q = params.toString();
  return q ? `?${q}` : '';
}
