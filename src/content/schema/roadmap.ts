import { z } from 'zod';
import { bilingual } from './bilingual';
import { FAMILIES } from './enums';

/**
 * Un des 200 intitulés de la feuille de route (CDC 6.2).
 *
 * Ce ne sont pas des fiches : aucun contenu de barreau n'existe pour eux.
 * Ils montrent l'ampleur du catalogue visé, valident que l'architecture tient
 * à 200 entrées, et donnent aux contributeurs une liste où se servir.
 */
export const roadmapItemSchema = z.object({
  id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
  family: z.enum(FAMILIES),
  title: bilingual('titre'),
  need: bilingual('besoin'),
});

export type RoadmapItem = z.infer<typeof roadmapItemSchema>;
