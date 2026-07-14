# Authentication patterns

`integrationType` selects how credentials are collected and stored on the shared
`integrationCredential` table (`src/core/db/schema/schema.ts`):

```ts
integrationCredential {
  integration, integrationType,
  apiKey,                          // API_KEY
  accessToken, refreshToken, tokenExpiration,   // OAUTH
  accessKey, secretKey, baseUrl,   // BASIC_TOKEN (the three allowed `inputs`)
  options //any other inputs that may be needed (store them in a Record<string, string>)
}
```

Read them with `getIntegrationCredentialByIntegration("<Name>", db)` and write
with `upsertIntegrationCredential(cred, db)` (both in
`src/core/db/queries/queries.ts`). Both take the shared `db: SqliteDb` handle —
it is threaded in as a parameter (see `anatomy.md`), never imported.

## BASIC_TOKEN

User enters `accessKey` / `secretKey` / `baseUrl` via the `inputs` array. The UI
collects them; you assemble the auth header. From Gong
(`src/integrations/gong/sync-steps/sync-calls-step.ts`):

```ts
export const getCredentials = async (db: SqliteDb) => {
  const cred = await getIntegrationCredentialByIntegration("Gong", db);
  const basicToken = btoa(cred?.accessKey + ":" + cred?.secretKey);  // base64(access:secret)
  return { basicToken, baseUrl: cred?.baseUrl };
};
// ... headers: { Authorization: `Basic ${basicToken}` }
```

Config: `integrationType: "BASIC_TOKEN"` with the three `inputs`. See
`references/anatomy.md`.

## API_KEY

User enters a single key (stored in `apiKey`). Declare the relevant `inputs`,
read `cred?.apiKey`, and send it however the API expects (bearer header, query
param, etc.). Same `getIntegrationCredentialByIntegration` read pattern as above.

## OAUTH

Three pieces: an authorization URL in the config, a `handleRedirect` callback
that exchanges the code for tokens, and a `refreshAccessTokens` hook.

### Config (`config.ts`)

From Notion (`src/integrations/notion/config.ts`):

```ts
export const notionConfig: IntegrationConfig = {
  integration: "notion",
  icon: "/assets/notion.png",
  integrationType: "OAUTH",
  description: "Connect Notion via OAuth",
  oauthAuthorizationUrl: `https://api.notion.com/v1/oauth/authorize?client_id=${process.env.BUN_PUBLIC_NOTION_CLIENT_ID}&response_type=code&owner=user&redirect_uri=http%3A%2F%2Flocalhost%3A9000%2Fapi%2Foauth%2Fnotion`,
};
```

The redirect URI must point at `/api/oauth/<name>` — that route dispatches to
your `handleRedirect`.

### Callback (`handleRedirect`)

From Notion (`src/integrations/notion/integration.ts`):

```ts
import type { BunRequest } from "bun";
import { upsertIntegrationCredential } from "@/core/db/queries/queries";
import type { SqliteDb } from "@/core/models/db-models";

const handleOauthRedirect = async (req: BunRequest, db: SqliteDb) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) return Response.json({ error: "missing code" }, { status: 400 });

  const clientId = process.env.BUN_PUBLIC_NOTION_CLIENT_ID ?? "";
  const clientSecret = process.env.NOTION_CLIENT_SECRET ?? "";

  const res = await fetch("https://api.notion.com/v1/oauth/token", {
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
  if (!res.ok) return Response.json({ error: "token exchange failed" }, { status: 502 });

  const token = await res.json() as { access_token: string; refresh_token: string };

  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "notion",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token,
  }, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};
```

### Wiring into the `Integration`

```ts
export const notionIntegration: Integration = {
  config: notionConfig,
  syncPipeline: notionPipeline,   // defined in pipeline.ts
  deleteSync: async (db: SqliteDb) => { /* purge data + syncTasks + artifacts + embeddings */ },
  handleRedirect: handleOauthRedirect,        // (req, db) — implement in <name>-utils.ts
  refreshAccessTokens: handleNotionRefresh,   // (db)      — implement in <name>-utils.ts
};
```

`refreshAccessTokens(db)` uses the stored `refreshToken` to mint a new
`accessToken` and `upsertIntegrationCredential`s it back. Implement it in a
`sync-steps/<name>-utils.ts` helper (see Notion's `handleNotionRefresh`).

### Required env vars

OAuth integrations need client credentials in `.env`. The `BUN_PUBLIC_` prefix
makes a var available to the frontend at build time (used in
`oauthAuthorizationUrl`); the secret stays server-side. Notion's pair:

```
BUN_PUBLIC_NOTION_CLIENT_ID=...
NOTION_CLIENT_SECRET=...
```

Also relevant: `BUN_PUBLIC_BACKEND_BASE_URL` (used to build the redirect URI).
