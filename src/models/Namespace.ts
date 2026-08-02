import { pgSchema } from 'drizzle-orm/pg-core';

/**
 * Dedicated Postgres schema for application tables.
 *
 * Keeping our tables out of `public` isolates them from Supabase-managed
 * objects and from anything a future extension drops into the default schema,
 * so grants and backups can target the application surface precisely.
 */
export const cardnews = pgSchema('cardnews');
