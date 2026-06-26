import type { Integration } from "@/core/models/models";
import { indexVectorDbStep } from "../../core/services/index-vector-db-step";
import { deleteMdArtifactsByIntegration, deleteSyncTasksByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import { deleteEmbeddingByIntegration } from "@/core/db/queries/vector-queries";
import { notionConfig } from "./config";
import type { BunRequest } from "bun";
import { handleNotionRefresh, NOTION_BASE_API } from "./sync-steps/notion-utils";
import { syncNotionPages } from "./sync-steps/sync-notion-pages";
import { deleteNotionData, getMostRecentEditedTime } from "./db/queries";
import { syncNotionMarkdown } from "./sync-steps/sync-notion-markdown";
import { notionMarkdownToArtifact } from "./sync-steps/notion-markdown-to-artifact";

export const syncNotionPipeline = async (incremental: boolean = true) => {
  const lastEditedDate: string | null = await getMostRecentEditedTime();
  await syncNotionPages();
  await syncNotionMarkdown(incremental ? {lastEditedDate} : undefined);
  await notionMarkdownToArtifact(incremental ? {lastEditedDate} : undefined);
  await indexVectorDbStep("notion", incremental);
}

const handleOauthRedirect = async (req: BunRequest) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_NOTION_CLIENT_ID ?? "";
  const clientSecret = process.env.NOTION_CLIENT_SECRET ?? "";

  const res = await fetch(`${NOTION_BASE_API}/oauth/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/notion`,
    }),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as {
    access_token: string;
    refresh_token: string;
    bot_id: string;
    owner: any;
    workspace_icon: string;
    workspace_id: string;
    workspace_name: string;
  };


  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "notion",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  });

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
}

export const notionIntegration: Integration = {
  config: notionConfig,
  sync: async () => await syncNotionPipeline(false),
  syncUpdates: async () => await syncNotionPipeline(true),
  deleteSync: async () => {
    await deleteNotionData();
    await deleteSyncTasksByIntegration("notion");
    await deleteMdArtifactsByIntegration("notion");
    await deleteEmbeddingByIntegration("notion");
  },
  handleRedirect: handleOauthRedirect,
  refreshAccessTokens: handleNotionRefresh,
}
