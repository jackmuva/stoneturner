import { serve } from "bun";
import index from "./client/index.html";
import { handleConfigureSyncSchedule, handleDeleteSyncSchedule, handleGetAllSyncTasks, handleGetArtifactById, handleGetArtifacts, handleGetIntegrations, handleGetRecentSyncTasks, handleGetSyncScheduleByIntegration, handleGetSyncTasks, handleGetSyncTaskSteps, handleNewIntegrationCredential } from "./core/handlers/handler";
import { withCors } from "./core/middleware/middleware";
import { handleMcp } from "./core/handlers/mcp-handler";
import { supportedIntegrations } from "./integrations/integration-registry";
import { db } from "./core/db/db";
import { retryFailedTasks } from "./core/services/retry-cron";
import { deleteSyncTasksPriorToDate } from "./core/db/queries/queries";
import { syncNewCron } from "./core/services/sync-new-cron";

const server = serve({
  routes: {
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
    },
    "/api/syncTasks/steps": {
      GET: withCors(async (_req) =>
        handleGetSyncTaskSteps(db)
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
    "/api/artifact/:id": {
      GET: withCors(async (req) =>
        handleGetArtifactById(req, db)
      )
    },
    "/api/oauth/:integration": {
      GET: withCors(async (req) => {
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
      }),
    },
    "/api/syncTasks/retry": {
      POST: withCors(async (req) => {
        retryFailedTasks(db);
        return Response.json(null, { status: 200 });
      }),
    },
    "/api/sync-schedule": {
      POST: withCors(async (req) => {
        return handleConfigureSyncSchedule(req, db);
      }),
    },
    "/api/sync-schedule/:integration": {
      GET: withCors(async (req) => {
        return handleGetSyncScheduleByIntegration(req, db);
      }),
      DELETE: withCors(async (req) => {
        return handleDeleteSyncSchedule(req, db);
      }),
    },

    "/mcp": {
      POST: async (req) => handleMcp(req, db),
      GET: () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
      DELETE: () => new Response(null, { status: 405, headers: { Allow: "POST" } }),
    },
  },
  port: process.env.PORT ?? 9000,
  development: process.env.NODE_ENV !== "production" && {
    // Enable browser hot reloading in development
    hmr: true,

    // Echo console logs from the browser to the server
    console: true,
  },
});

const retryJob = Bun.cron("0 0 * * *", async () => {
  if (process.env.CRON_ENABLED !== 'false') {
    await retryFailedTasks(db);
  }
});

const deleteStaleJob = Bun.cron("0 0 * * *", async () => {
  if (process.env.CRON_ENABLED !== 'false') {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 14);
    await deleteSyncTasksPriorToDate(cutoff.toISOString(), db!);
  }
});

const syncScheduleJob = Bun.cron("0 0 * * *", async () => {
  if (process.env.CRON_ENABLED !== 'false') {
    await syncNewCron(db);
  }
});

console.log(`🚀 Server running at ${server.url}`);
