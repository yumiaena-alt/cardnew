import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  out: './migrations',
  // Glob rather than a barrel file: each domain module is picked up directly,
  // so no re-export hub is needed and the barrel-file lint rule stays satisfied.
  schema: './src/models/*.ts',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL ?? '',
  },
  verbose: true,
  strict: true,
});
