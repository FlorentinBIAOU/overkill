import { z } from 'zod';
import { bilingual } from './bilingual';
import { FAMILIES } from './enums';

/** Fichier de famille (CDC 5.3). */
export const familySchema = z.object({
  id: z.enum(FAMILIES),
  /** Ordre d'affichage sur l'accueil et dans les filtres. */
  order: z.number().int().min(1).max(10),
  title: bilingual('titre de la famille'),
  /** Deux à quatre phrases. */
  description: bilingual('description de la famille'),
  /** La question que se pose quelqu'un qui arrive dans cette famille. */
  question: bilingual('question type'),
  /** Nom du fichier dans src/assets/illustrations/, sans extension. */
  illustration: z.string().regex(/^[a-z0-9-]+$/),
});

export type Family = z.infer<typeof familySchema>;
