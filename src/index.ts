import { serve } from "bun";
import index from "./client/index.html";
import { handleGetIntegrations, handleGetRecentSyncTasks, handleNewIntegrationCredential } from "./core/handlers/handler";
import { withCors } from "./core/middleware/middleware";
import { handleGongSync } from "./integrations/gong/handlers/handler";

const server = serve({
  routes: {
    // Serve static assets (integration icons, etc.) from src/assets, including subdirectories.
    "/assets/*": (req) => {
      const path = new URL(req.url).pathname.slice("/assets/".length);
      return new Response(Bun.file(`src/assets/${path}`));
    },

    // Serve index.html for all unmatched routes.
    "/*": index,
    "/api/integrations": {
      GET: withCors(async (req) => {
        return await handleGetIntegrations(req)
      }),
      POST: withCors(async (req) => {
        return await handleNewIntegrationCredential(req)
      }),
    },
    "/api/sync/gong": {
      POST: withCors(async (req) =>
        handleGongSync(req)
      ),
    },
    "/api/syncTasks/recent": {
      GET: withCors(async (req) =>
        handleGetRecentSyncTasks(req)
      ),
    },
  },

  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
