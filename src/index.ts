import { serve } from "bun";
import index from "./client/index.html";
import { handleGetAllSyncTasks, handleGetArtifacts, handleGetIntegrations, handleGetRecentSyncTasks, handleGetSyncTasks, handleGetSyncTaskSteps, handleNewIntegrationCredential, handleDeleteStaleSyncTasks } from "./core/handlers/handler";
import { withCors } from "./core/middleware/middleware";
import { handleMcp } from "./core/handlers/mcp-handler";
import { supportedIntegrations } from "./integrations/sync-registry";
import { db } from "./core/db/db";

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
        return await handleGetIntegrations(req, db)
      }),
      POST: withCors(async (req) => {
        return await handleNewIntegrationCredential(req, db)
      }),
    },
    "/api/sync/updates/:integration": {
      POST: withCors(async (req) => {
        if (req.params.integration) {
          const target = req.params.integration.toLowerCase();
          const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === target);
          if (index === -1) return Response.json(null, { status: 400 });
          supportedIntegrations[index]!.syncUpdates(db);
          return Response.json(null, { status: 200 });
        }
        return Response.json(null, { status: 400 });
      }),
    },
    "/api/sync/:integration": {
      POST: withCors(async (req) => {
        if (req.params.integration) {
          const target = req.params.integration.toLowerCase();
          const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === target);
          if (index === -1) return Response.json(null, { status: 400 });
          supportedIntegrations[index]!.sync(db);
          return Response.json(null, { status: 200 });
        }
        return Response.json(null, { status: 400 });
      }),
      DELETE: withCors(async (req) => {
        if (req.params.integration) {
          const target = req.params.integration.toLowerCase();
          const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === target);
          if (index === -1) return Response.json(null, { status: 400 });
          supportedIntegrations[index]!.deleteSync(db);
          return Response.json(null, { status: 200 });
        }
        return Response.json(null, { status: 400 });
      }),
    },
    "/api/syncTasks": {
      GET: withCors(async (req) =>
        handleGetAllSyncTasks(req, db)
      ),
    },
    "/api/syncTasks/recent": {
      GET: withCors(async (req) =>
        handleGetRecentSyncTasks(req, db)
      ),
      DELETE: withCors(async () =>
        handleDeleteStaleSyncTasks()
      ),
    },
    "/api/syncTasks/steps": {
      GET: withCors(async () =>
        handleGetSyncTaskSteps()
      ),
    },
    "/api/syncTasks/:integration": {
      GET: withCors(async (req) =>
        handleGetSyncTasks(req, db)
      )
    },
    "/api/artifacts/:integration": {
      GET: withCors(async (req) =>
        handleGetArtifacts(req, db)
      )
    },
    "/api/oauth/:integration": {
      GET: async (req) => {
        if (req.params.integration) {
          const target = req.params.integration.toLowerCase();
          const index = supportedIntegrations.findIndex((integ) => integ.config.integration.toLowerCase() === target);
          if (index === -1) return Response.json(null, { status: 400 });
          if (supportedIntegrations[index]!.handleRedirect) {
            return await supportedIntegrations[index]!.handleRedirect(req, db);
          };
          return Response.json(null, { status: 200 });
        }
        return Response.json(null, { status: 400 });
      }
    },

    // Streamable HTTP MCP endpoint (stateless JSON-RPC). Not wrapped in withCors:
    // MCP desktop/CLI clients call it server-side and don't need browser CORS.
    "/mcp": {
      POST: async(req) => handleMcp(req, db),
      GET: async(req) => handleMcp(req, db),
      DELETE: async(req) => handleMcp(req, db),
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
