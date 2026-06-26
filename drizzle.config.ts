import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/core/db/schema/*',
    './src/integrations/gong/db/schema.ts',
    './src/integrations/discord/db/schema.ts',
    './src/integrations/notion/db/schema.ts',
  ],
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.BUN_PUBLIC_DEV_MODE === "false" ? 'file:stoneturner.db' : 'file:test-stoneturner.db',
  },
});
