import { z } from 'zod';

/**
 * Page éditoriale (CDC 7.6 à 7.10). Une page par langue, le lien entre les
 * deux versions se faisant par la clé `page`.
 */
export const pageSchema = z.object({
  /** Identifiant partagé par les deux versions linguistiques. */
  page: z.string().regex(/^[a-z0-9-]+$/),
  lang: z.enum(['en', 'fr']),
  title: z.string().trim().min(1),
  description: z.string().trim().min(1),
  /**
   * Un texte encore en attente de relecture le déclare ici. Le gabarit affiche
   * alors un bandeau visible : l'interdit 10 du CDC refuse le faux contenu,
   * il n'interdit pas un brouillon assumé.
   */
  draft: z.boolean().default(false),
  draft_reason: z.string().trim().min(1).optional(),
  updated: z.coerce.date(),
});

export type Page = z.infer<typeof pageSchema>;
