import { serve } from "bun";
import index from "./client/index.html";
import { handleGetAllSyncTasks, handleGetArtifacts, handleGetIntegrations, handleGetRecentSyncTasks, handleGetSyncTasks, handleNewIntegrationCredential } from "./core/handlers/handler";
import { withCors } from "./core/middleware/middleware";
import { handleMcp } from "./core/handlers/mcp-handler";
import { supportedIntegrations } from "./integrations/sync-registry";

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
"/api/sync/updates/:integration": {
      POST: withCors(async (req) => {
        if (req.params.integration) {
          const index = supportedIntegrations.map((integ) => integ.config.integration).indexOf(req.params.integration);
          if (index === -1) return Response.json(null, { status: 400 });
          supportedIntegrations[index]!.syncUpdates();
        }
        return Response.json(null, { status: 400 });
      }),
    },
    "/api/sync/:integration": {
      POST: withCors(async (req) => {
        if (req.params.integration) {
          const index = supportedIntegrations.map((integ) => integ.config.integration).indexOf(req.params.integration);
          if (index === -1) return Response.json(null, { status: 400 });
          supportedIntegrations[index]!.sync();
        }
        return Response.json(null, { status: 400 });
      }),
      DELETE: withCors(async (req) => {
        if (req.params.integration) {
          const index = supportedIntegrations.map((integ) => integ.config.integration).indexOf(req.params.integration);
          if (index === -1) return Response.json(null, { status: 400 });
          supportedIntegrations[index]!.deleteSync();
        }
        return Response.json(null, { status: 400 });
      }),
    },
        "/api/syncTasks": {
      GET: withCors(async (req) =>
        handleGetAllSyncTasks(req)
      ),
    },
        "/api/syncTasks/recent": {
      GET: withCors(async (req) =>
        handleGetRecentSyncTasks(req)
      ),
    },
    "/api/syncTasks/:integration": {
      GET: withCors(async (req) =>
        handleGetSyncTasks(req)
      )
    },
    "/api/artifacts/:integration": {
      GET: withCors(async (req) =>
        handleGetArtifacts(req)
      )
    },

    // Streamable HTTP MCP endpoint (stateless JSON-RPC). Not wrapped in withCors:
    // MCP desktop/CLI clients call it server-side and don't need browser CORS.
    "/mcp": {
      POST: handleMcp,
      GET: handleMcp,
      DELETE: handleMcp,
    },
  },
  port: 9000,
  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

console.log(`🚀 Server running at ${server.url}`);
