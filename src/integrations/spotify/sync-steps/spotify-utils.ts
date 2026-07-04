import { getIntegrationCredentialByIntegration, upsertIntegrationCredential, upsertSyncTask } from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { SpotifyTokenResponse } from "../models/models";

export const spotifyApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

export const SPOTIFY_API_BASE = "https://api.spotify.com/v1";
export const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";
export const SPOTIFY_PAGE_SIZE = 50;

export const getSpotifyCredentials = async (db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("spotify", db);
};

const exchangeToken = async (body: URLSearchParams): Promise<SpotifyTokenResponse | null> => {
  const clientId = process.env.BUN_PUBLIC_SPOTIFY_CLIENT_ID ?? "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET ?? "";

  const res = await fetch(SPOTIFY_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) return null;
  return await res.json() as SpotifyTokenResponse;
};

const persistSpotifyToken = async (
  cred: { id: string; refreshToken?: string | null },
  token: SpotifyTokenResponse,
  db: SqliteDb,
): Promise<void> => {
  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();
  await upsertIntegrationCredential({
    id: cred.id,
    integration: "spotify",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? cred.refreshToken,
    tokenExpiration,
  }, db);
};

export const handleSpotifyRefresh = async (db: SqliteDb): Promise<void> => {
  const cred = await getSpotifyCredentials(db);
  if (!cred?.refreshToken) return;

  const token = await exchangeToken(new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: cred.refreshToken,
  }));

  if (!token) {
    await upsertSyncTask({
      integration: "spotify",
      status: "FAILED",
      step: "spotify-token-revalidation",
      inputs: { error: "refresh failed" },
    }, db);
    return;
  }

  await persistSpotifyToken(cred, token, db);
};

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/spotify`;
  const token = await exchangeToken(new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  }));

  if (!token) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  await persistSpotifyToken({
    id: crypto.randomUUID(),
  }, token, db);

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
};

export const spotifyFetch = async (path: string, db: SqliteDb, init?: RequestInit): Promise<Response> => {
  const doFetch = async (): Promise<Response> => {
    const cred = await getSpotifyCredentials(db);
    if (!cred?.accessToken) throw new Error("Missing Spotify credential");

    return await fetch(`${SPOTIFY_API_BASE}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...init?.headers,
        Authorization: `Bearer ${cred.accessToken}`,
      },
    });
  };

  let res = await spotifyApiBottleneck.schedule(() => doFetch());

  if (res.status === 401) {
    await handleSpotifyRefresh(db);
    res = await spotifyApiBottleneck.schedule(() => doFetch());
  }

  return res;
};

export const formatArtists = (artists: { name: string }[] | undefined): string => {
  return (artists ?? []).map((a) => a.name).join(", ");
};

export const formatDuration = (durationMs: number | null | undefined): string => {
  if (!durationMs) return "";
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};
