import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/core/db/schema/*',
    './src/integrations/gong/db/schema.ts',
  ],
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: 'file:stoneturner.db',
  },
});
