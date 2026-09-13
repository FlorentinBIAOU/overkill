/**
 * Le questionnaire, parcours par parcours.
 *
 * Le contrôle lit la charge utile réellement livrée par la page construite, et
 * non une copie : ce qui est vérifié est ce que le navigateur reçoit.
 *
 * Il épuise les combinaisons : chaque famille, chaque tâche de cette famille,
 * et toutes les réponses possibles aux questions de contrainte. Le cahier des
 * charges du lot demande que tout parcours aboutisse à au moins une fiche
 * existante ou au message honnête ; c'est ce que ce fichier démontre.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeVerdict } from '../src/lib/guide-verdict.mjs';

function charge(langue) {
  const html = readFileSync(`dist/${langue}/par-ou-commencer/index.html`, 'utf8');
  const m = html.match(
    /<script type="application\/json" data-guide-payload[^>]*>([\s\S]*?)<\/script>/,
  );
  assert.ok(m, `charge utile introuvable dans la page ${langue}`);
  return JSON.parse(m[1].replaceAll('&amp;', '&').replaceAll('&lt;', '<').replaceAll('&gt;', '>'));
}

const REPONSES = {
  frequence: ['basse', 'moyenne', 'haute', 'nsp'],
  egress: ['oui', 'non', 'nsp'],
  meme: ['oui', 'non', 'nsp'],
  verifier: ['oui', 'non', 'nsp'],
  exemples: ['beaucoup', 'quelques', 'aucun', 'nsp'],
  heberger: ['oui', 'non', 'nsp'],
};

/** Toutes les combinaisons des questions de contrainte. */
function combinaisons() {
  let out = [{}];
  for (const [cle, valeurs] of Object.entries(REPONSES)) {
    out = out.flatMap((base) => valeurs.map((v) => ({ ...base, [cle]: v })));
  }
  return out;
}

const COMBINAISONS = combinaisons();

for (const langue of ['fr', 'en']) {
  const p = charge(langue);
  const notesConnues = new Set(Object.keys(p.strings.verdict.notes));

  test(`${langue} — la charge utile porte les fiches et les familles`, () => {
    assert.equal(p.data.families.length, 10);
    assert.ok(p.data.entries.length >= 25);
    for (const e of p.data.entries) {
      assert.ok(e.id && e.family && e.verdict, `fiche incomplète : ${e.id}`);
      assert.ok(e.rationale.length > 20, `justification manquante : ${e.id}`);
      // Ce qui est déjà dans le HTML n'est pas renvoyé dans la charge utile.
      assert.equal(e.title, undefined, `${e.id} : le titre est déjà dans la page`);
      assert.equal(e.need, undefined, `${e.id} : le besoin est déjà dans la page`);
      assert.ok(
        e.rungs.some((r) => r.level === e.verdict),
        `le verdict de ${e.id} ne désigne aucun niveau disponible`,
      );
    }
  });

  test(`${langue} — chaque fiche est atteignable par sa famille`, () => {
    for (const e of p.data.entries) {
      assert.ok(
        p.data.families.some((f) => f.id === e.family),
        `la famille ${e.family} de ${e.id} n'est pas proposée`,
      );
    }
    // Et toute famille proposée mène quelque part : soit des fiches, soit le
    // message honnête, jamais une liste vide silencieuse.
    for (const f of p.data.families) {
      const fiches = p.data.entries.filter((e) => e.family === f.id);
      const v = computeVerdict({ family: f.id }, p.data);
      if (fiches.length === 0) assert.equal(v.kind, 'familleSansFiche');
    }
  });

  test(`${langue} — tout parcours aboutit, ${COMBINAISONS.length} combinaisons par fiche`, () => {
    let verdicts = 0;
    for (const fiche of p.data.entries) {
      for (const c of COMBINAISONS) {
        const v = computeVerdict({ ...c, family: fiche.family, entry: fiche.id }, p.data);
        verdicts += 1;
        assert.equal(v.kind, 'fiche');
        assert.equal(v.entry.id, fiche.id);
        const retenu = fiche.rungs.find((r) => r.level === v.niveau);
        assert.ok(retenu, `${fiche.id} : niveau ${v.niveau} hors des niveaux disponibles`);
        assert.equal(v.nom, retenu.name);
        for (const n of v.notes) {
          assert.ok(notesConnues.has(n.cle), `note inconnue : ${n.cle}`);
        }
        // Une contrainte exprimée est soit satisfaite, soit dite impossible.
        if (c.egress === 'non' && retenu.risks.data_egress === 'third-party') {
          assert.ok(
            v.notes.some((n) => n.cle === 'egressSansIssue'),
            `${fiche.id} : sortie de données contredite sans le dire`,
          );
        }
        if (c.meme === 'oui' && retenu.risks.deterministic !== true) {
          assert.ok(v.notes.some((n) => n.cle === 'memeSansIssue'));
        }
        if (c.verifier === 'oui' && retenu.risks.testability === 'hard') {
          assert.ok(v.notes.some((n) => n.cle === 'verifierSansIssue'));
        }
      }
    }
    assert.ok(verdicts > 30000, `seulement ${verdicts} verdicts calculés`);
  });

  test(`${langue} — sans tâche désignée, le message honnête et un catalogue filtré`, () => {
    for (const c of COMBINAISONS.slice(0, 200)) {
      const sansFamille = computeVerdict({ ...c }, p.data);
      assert.equal(sansFamille.kind, 'sansTache');
      assert.ok(typeof sansFamille.filtres === 'string');

      const famille = p.data.families[0];
      const sansFiche = computeVerdict({ ...c, family: famille.id }, p.data);
      assert.equal(sansFiche.kind, 'familleSansFiche');
      assert.ok(sansFiche.entries.length > 0, 'la famille doit proposer ses fiches');
      if (c.egress === 'non') assert.match(sansFiche.filtres, /egress=none/);
      if (c.meme === 'oui') assert.match(sansFiche.filtres, /deterministic=true/);
    }
  });

  test(`${langue} — sous contrainte maximale, le verdict tient ou cède au plus frugal`, () => {
    const rang = { N0: 0, N1: 1, N2: 2, N3: 3 };
    for (const fiche of p.data.entries) {
      // Rien ne sort, résultat reproductible, vérifiable cas par cas.
      const v = computeVerdict(
        { family: fiche.family, entry: fiche.id, egress: 'non', meme: 'oui', verifier: 'oui' },
        p.data,
      );
      const admissibles = fiche.rungs.filter(
        (r) =>
          r.risks.data_egress !== 'third-party' &&
          r.risks.deterministic === true &&
          r.risks.testability !== 'hard',
      );
      const verdictAdmissible = admissibles.some((r) => r.level === fiche.verdict);

      if (verdictAdmissible) {
        /* Le verdict de la fiche satisfait la contrainte : il tient. Descendre
           plus bas « parce que c'est plus frugal » serait recommander une
           option dont la fiche a établi qu'elle ne fait pas le travail. */
        assert.equal(v.niveau, fiche.verdict, `${fiche.id} : le verdict devait tenir`);
        assert.equal(v.deplace, false);
      } else if (admissibles.length > 0) {
        // Il ne la satisfait pas : on cède au plus frugal qui la satisfait.
        const attendu = admissibles.sort((a, b) => rang[a.level] - rang[b.level])[0];
        assert.equal(v.niveau, attendu.level, `${fiche.id} : niveau retenu inattendu`);
        assert.equal(v.deplace, true);
        assert.ok(v.notes.length > 0, 'un déplacement doit être expliqué');
      } else {
        assert.equal(v.niveau, fiche.verdict);
        assert.ok(v.conflit, `${fiche.id} : contrainte impossible non signalée`);
      }
    }
  });
}
