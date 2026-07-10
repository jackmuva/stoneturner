import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: [
    './src/core/db/schema/*',
    './src/integrations/gong/db/schema.ts',
    './src/integrations/discord/db/schema.ts',
    './src/integrations/notion/db/schema.ts',
    './src/integrations/plaud/db/schema.ts',
    './src/integrations/firecrawl/db/schema.ts',
    './src/integrations/github/db/schema.ts',
    './src/integrations/spotify/db/schema.ts',
    './src/integrations/slack/db/schema.ts',
    './src/integrations/twitter/db/schema.ts',
    './src/integrations/hubspot/db/schema.ts',
  ],
  out: './migrations',
  dialect: 'turso',
  dbCredentials: {
    url: process.env.BUN_PUBLIC_DEV_MODE === "false" ? 'file:stoneturner.db' : 'file:test-stoneturner.db',
  },
});
