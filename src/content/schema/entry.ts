import { z } from 'zod';
import { bilingual } from './bilingual';
import { rungSchema } from './rung';
import { FAMILIES, LEVELS, STATUSES } from './enums';

const KEBAB = /^[a-z0-9]+(-[a-z0-9]+)*$/;

const link = z.object({
  label: z.string().trim().min(1),
  url: z.string().url(),
});

/**
 * Schéma d'une fiche (CDC 5.1) et ses contraintes de validation (CDC 5.2).
 *
 * Ce que Zod vérifie ici : la forme, les énumérations, la complétude bilingue,
 * la cohérence interne du document.
 *
 * Ce que Zod ne peut pas vérifier et que `scripts/check-content.mjs` prend en
 * charge : l'existence des fichiers de code sur le disque, l'unicité des
 * identifiants entre fiches, l'égalité entre l'identifiant et le nom de
 * fichier, et le passage effectif des tests des extraits.
 */
export const entrySchema = z
  .object({
    id: z.string().regex(KEBAB, "l'identifiant doit être en kebab-case"),
    family: z.enum(FAMILIES),
    status: z.enum(STATUSES),
    verdict: z.enum(LEVELS),
    updated: z.coerce.date(),
    contributors: z.array(z.string().regex(KEBAB)).min(1),

    title: bilingual('titre'),
    need: bilingual('besoin'),
    scenario: bilingual('scénario'),

    rungs: z.array(rungSchema).length(4, 'les quatre barreaux N0 à N3 sont attendus'),

    verdict_rationale: bilingual('justification du verdict'),

    further_reading: z.array(link).default([]),
    sources: z.array(link).default([]),
  })
  // Les quatre barreaux, dans l'ordre, jamais réordonnés (CDC 4.1).
  .refine((e) => e.rungs.every((r, i) => r.level === LEVELS[i]), {
    message: "les barreaux doivent être présents dans l'ordre N0, N1, N2, N3",
    path: ['rungs'],
  })
  // Le verdict désigne un barreau dont `available` vaut true (CDC 5.2).
  .refine(
    (e) => {
      const r = e.rungs.find((x) => x.level === e.verdict);
      return r !== undefined && r.available === true;
    },
    {
      message: 'le verdict doit désigner un barreau disponible',
      path: ['verdict'],
    },
  )
  // La date de révision n'est pas dans le futur (CDC 5.2).
  .refine((e) => e.updated.getTime() <= Date.now() + 86_400_000, {
    message: "la date de révision ne peut pas être dans le futur",
    path: ['updated'],
  });

export type Entry = z.infer<typeof entrySchema>;
