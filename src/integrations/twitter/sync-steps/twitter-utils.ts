import {
  getIntegrationCredentialByIntegration,
  upsertIntegrationCredential,
  upsertSyncTask,
} from "@/core/db/queries/queries";
import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { SqliteDb } from "@/core/models/db-models";
import { retry } from "@/lib/utils";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type {
  TwitterTokenResponse,
  TwitterTweetListResponse,
  TwitterUser,
  TwitterUserResponse,
} from "../models/models";

export const TWITTER_API = "https://api.twitter.com/2";
export const TWITTER_AUTH_URL = "https://twitter.com/i/oauth2/authorize";
export const TWITTER_TOKEN_URL = "https://api.twitter.com/2/oauth2/token";

export const TWITTER_SCOPES = [
  "tweet.read",
  "users.read",
  "like.read",
  "offline.access",
].join(" ");

export const twitterApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200,
});

const PKCE_COOKIE = "twitter_pkce_verifier";
const STATE_COOKIE = "twitter_oauth_state";
const COOKIE_MAX_AGE = 600;

const base64UrlEncode = (bytes: Uint8Array): string => {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};

const generateCodeVerifier = (): string => {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
};

const generateCodeChallenge = async (verifier: string): Promise<string> => {
  const data = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return base64UrlEncode(new Uint8Array(digest));
};

const generateState = (): string => base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));

const cookieHeader = (name: string, value: string, maxAge: number): string =>
  `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;

const readCookie = (req: BunRequest, name: string): string | null => {
  const cookie = req.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [rawKey, ...rest] = part.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rest.join("="));
  }
  return null;
};

const clearOAuthCookies = (): string[] => [
  `${PKCE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
  `${STATE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`,
];

export const getTwitterCredentials = async (db: SqliteDb): Promise<IntegrationCredential | undefined> => {
  return await getIntegrationCredentialByIntegration("twitter", db);
};

export const getAuthenticatedTwitterUser = async (db: SqliteDb): Promise<TwitterUser> => {
  const body = await twitterFetchWithRefresh<TwitterUserResponse>(
    "/users/me",
    db,
    { "user.fields": "id" },
  );
  if (!body.data?.id) throw new Error("Failed to resolve authenticated Twitter user");
  return body.data;
};

export const getTwitterToken = async (db: SqliteDb): Promise<string> => {
  const cred = await getTwitterCredentials(db);
  if (!cred?.accessToken) throw new Error("Missing Twitter credential");
  return cred.accessToken;
};

const exchangeToken = async (body: URLSearchParams): Promise<TwitterTokenResponse> => {
  const clientId = process.env.BUN_PUBLIC_TWITTER_CLIENT_ID ?? "";
  const clientSecret = process.env.TWITTER_CLIENT_SECRET ?? "";

  const res = await fetch(TWITTER_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body,
  });

  if (!res.ok) throw new Error(await res.text());
  return await res.json() as TwitterTokenResponse;
};

const persistTwitterTokens = async (
  db: SqliteDb,
  token: TwitterTokenResponse,
  existing?: IntegrationCredential,
): Promise<void> => {
  const expiresIn = token.expires_in ?? 7200;
  const tokenExpiration = new Date(Date.now() + expiresIn * 1000).toISOString();

  await upsertIntegrationCredential({
    id: existing?.id ?? crypto.randomUUID(),
    integration: "twitter",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? existing?.refreshToken ?? null,
    tokenExpiration,
    options: null,
  }, db);
};

const redirectToTwitterAuthorize = async (): Promise<Response> => {
  const clientId = process.env.BUN_PUBLIC_TWITTER_CLIENT_ID ?? "";
  if (!clientId) {
    return Response.json({ error: "missing BUN_PUBLIC_TWITTER_CLIENT_ID" }, { status: 500 });
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = await generateCodeChallenge(codeVerifier);
  const state = generateState();
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/twitter`;

  const url = new URL(TWITTER_AUTH_URL);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("scope", TWITTER_SCOPES);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");

  return new Response(null, {
    status: 302,
    headers: (() => {
      const headers = new Headers();
      headers.set("Location", url.toString());
      headers.append("Set-Cookie", cookieHeader(PKCE_COOKIE, codeVerifier, COOKIE_MAX_AGE));
      headers.append("Set-Cookie", cookieHeader(STATE_COOKIE, state, COOKIE_MAX_AGE));
      return headers;
    })(),
  });
};

export const handleTwitterOauthRedirect = async (req: BunRequest, db: SqliteDb): Promise<Response> => {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  if (!code) {
    const oauthError = url.searchParams.get("error");
    if (oauthError) {
      return Response.json({ error: oauthError }, { status: 400 });
    }
    return await redirectToTwitterAuthorize();
  }

  const state = url.searchParams.get("state");
  const storedState = readCookie(req, STATE_COOKIE);
  const codeVerifier = readCookie(req, PKCE_COOKIE);
  if (!codeVerifier) return Response.json({ error: "missing PKCE verifier — restart OAuth" }, { status: 400 });
  if (!state || !storedState || state !== storedState) {
    return Response.json({ error: "invalid OAuth state" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_TWITTER_CLIENT_ID ?? "";
  const redirectUri = `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/twitter`;
  const existing = await getTwitterCredentials(db);

  try {
    const token = await exchangeToken(new URLSearchParams({
      code,
      grant_type: "authorization_code",
      client_id: clientId,
      redirect_uri: redirectUri,
      code_verifier: codeVerifier,
    }));

    await persistTwitterTokens(db, token, existing);
  } catch (e) {
    return Response.json({ error: `token exchange failed: ${String(e)}` }, { status: 502 });
  }

  return new Response(null, {
    status: 302,
    headers: (() => {
      const headers = new Headers();
      headers.set("Location", process.env.BUN_PUBLIC_BACKEND_BASE_URL!);
      for (const cookie of clearOAuthCookies()) {
        headers.append("Set-Cookie", cookie);
      }
      return headers;
    })(),
  });
};

export const handleTwitterRefresh = async (db: SqliteDb): Promise<void> => {
  const cred = await getTwitterCredentials(db);
  if (!cred?.refreshToken) return;

  const clientId = process.env.BUN_PUBLIC_TWITTER_CLIENT_ID ?? "";

  try {
    const token = await exchangeToken(new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: cred.refreshToken,
      client_id: clientId,
    }));

    await persistTwitterTokens(db, token, cred);
  } catch (e) {
    await upsertSyncTask({
      integration: "twitter",
      status: "FAILED",
      inputs: { error: String(e) },
      step: "twitter-token-revalidation",
    }, db);
  }
};

export const twitterFetchJson = async <T>(
  path: string,
  token: string,
  params?: Record<string, string>,
): Promise<T> => {
  const url = new URL(path.startsWith("http") ? path : `${TWITTER_API}${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  return await twitterApiBottleneck.schedule(() =>
    retry(async () => {
      const res = await fetch(url, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error(`Twitter ${res.status}: ${await res.text()}`);
      return await res.json() as T;
    }),
  );
};

export const twitterFetchWithRefresh = async <T>(
  path: string,
  db: SqliteDb,
  params?: Record<string, string>,
): Promise<T> => {
  let token = await getTwitterToken(db);
  try {
    return await twitterFetchJson<T>(path, token, params);
  } catch (e) {
    const message = String(e);
    if (!message.includes("401")) throw e;
    await handleTwitterRefresh(db);
    token = await getTwitterToken(db);
    return await twitterFetchJson<T>(path, token, params);
  }
};

export const tweetFieldsParams = (): Record<string, string> => ({
  max_results: "100",
  "tweet.fields": "article,created_at,author_id,conversation_id,in_reply_to_user_id,lang,public_metrics,entities,referenced_tweets",
  expansions: "author_id,referenced_tweets.id",
  "user.fields": "username,name",
});

export const buildTweetUrl = (username: string | undefined, tweetId: string): string => {
  if (username) return `https://x.com/${username}/status/${tweetId}`;
  return `https://x.com/i/web/status/${tweetId}`;
};

export const userMapFromResponse = (body: TwitterTweetListResponse): Map<string, TwitterUser> => {
  const map = new Map<string, TwitterUser>();
  for (const user of body.includes?.users ?? []) {
    map.set(user.id, user);
  }
  return map;
};
