import { z } from 'zod';
import { bilingual, bilingualList } from './bilingual';
import {
  COSTS,
  DATA_EGRESS,
  FOOTPRINT,
  LATENCIES,
  LEVELS,
  TESTABILITY,
  VENDOR_LOCK,
  VERIFICATION,
} from './enums';

/**
 * Bloc risques : six champs, toujours renseignés (CDC 4.2, champ 5).
 * Aucun n'est optionnel. Un barreau disponible dont un seul champ manque est
 * rejeté au build.
 */
const risks = z.object({
  /** Rien ne sort / reste dans votre infra / part chez un tiers. */
  data_egress: z.enum(DATA_EGRESS),
  deterministic: z.boolean(),
  /** Testable unitairement / statistiquement / difficilement. */
  testability: z.enum(TESTABILITY),
  vendor_lock: z.enum(VENDOR_LOCK),
  /** Ordre de grandeur relatif, jamais de gCO₂e inventé (CDC 4.5, interdit 2). */
  footprint: z.enum(FOOTPRINT),
  /**
   * Factuel, daté, sans conseil (CDC 4.5, interdit 3). La formulation imposée
   * est portée par le composant d'affichage, pas par la donnée.
   */
  regulatory: bilingualList('périmètre réglementaire'),
});

/**
 * Chemins des extraits de code, relatifs à `content/`.
 * Au moins un langage est exigé, et la règle de vérité du code (CDC 4.6)
 * impose que les deux existent réellement sur le disque : c'est
 * `scripts/check-content.mjs` qui le vérifie, Zod ne voit pas le disque.
 */
const code = z
  .object({
    python: z.string().min(1).optional(),
    javascript: z.string().min(1).optional(),
    /**
     * Niveau de preuve d'exécution réellement atteint (décision D3 du plan).
     * `executed` : l'extrait tourne tel quel avec ses vraies dépendances.
     * `stubbed`  : il tourne, un service ou un modèle externe étant remplacé
     *              par un double local dans le test.
     */
    verification: z.enum(VERIFICATION),
  })
  .refine((c) => c.python || c.javascript, {
    message: 'au moins un fichier de code est exigé (python ou javascript)',
  });

/** Barreau disponible : les sept éléments de la section 4.2, tous obligatoires. */
const availableRung = z.object({
  level: z.enum(LEVELS),
  available: z.literal(true),
  /** Nom de l'approche, court et concret. */
  name: bilingual("nom de l'approche"),
  cost: z.enum(COSTS),
  latency: z.enum(LATENCIES),
  risks,
  code,
  /** Ce qui fait échouer cette approche, concrètement, avec un exemple. */
  breaking_point: bilingual('point de rupture'),
  /** La condition précise qui justifie le barreau suivant. */
  escalate_when: bilingual('déclencheur de montée'),
});

/**
 * Barreau absent. Le CDC interdit de le laisser vide sans explication :
 * « un barreau absent doit être marqué absent avec une raison courte ».
 */
const unavailableRung = z.object({
  level: z.enum(LEVELS),
  available: z.literal(false),
  unavailable_reason: bilingual("raison de l'absence du barreau"),
});

export const rungSchema = z.discriminatedUnion('available', [availableRung, unavailableRung]);

export type Rung = z.infer<typeof rungSchema>;
export type AvailableRung = z.infer<typeof availableRung>;
