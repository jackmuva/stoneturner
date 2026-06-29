import { getIntegrationCredentialByIntegration, upsertIntegrationCredential } from "@/core/db/queries/queries";
import Bottleneck from "bottleneck";
import type { BunRequest } from "bun";
import type { DiscordGuild } from "../models/models";
import { batchInsertDiscordGuild } from "../db/queries";
import type { SqliteDb } from "@/core/models/db-models";

export const discordApiBottleneck = new Bottleneck({
  maxConcurrent: 5,
  minTime: 200
});

export const DISCORD_API_ENDPOINT = "https://discord.com/api/v10";

export const refreshDiscordTokens = async (db: SqliteDb) => {
  const credential = await getIntegrationCredentialByIntegration("discord", db);
  if (!credential?.refreshToken) {
    throw new Error("no discord refresh token available");
  }

  const clientId = process.env.BUN_PUBLIC_DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

  const res = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: credential.refreshToken,
    }).toString(),
  });

  if (!res.ok) {
    throw new Error("discord token refresh failed");
  }

  const token = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
  };

  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await upsertIntegrationCredential({
    ...credential,
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? credential.refreshToken,
    tokenExpiration,
  }, db);
}

export const handleOauthRedirect = async (req: BunRequest, db: SqliteDb) => {
  const code = new URL(req.url).searchParams.get("code");
  if (!code) {
    return Response.json({ error: "missing code" }, { status: 400 });
  }

  const clientId = process.env.BUN_PUBLIC_DISCORD_CLIENT_ID ?? "";
  const clientSecret = process.env.DISCORD_CLIENT_SECRET ?? "";

  const res = await fetch(`${DISCORD_API_ENDPOINT}/oauth2/token`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
    },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/discord`,
    }).toString(),
  });

  if (!res.ok) {
    return Response.json({ error: "token exchange failed" }, { status: 502 });
  }

  const token = await res.json() as {
    access_token: string;
    refresh_token?: string;
    expires_in: number;
    token_type: string;
    scope: string;
    guild: DiscordGuild;
  };

  const tokenExpiration = new Date(Date.now() + token.expires_in * 1000).toISOString();

  await upsertIntegrationCredential({
    id: crypto.randomUUID(),
    integration: "discord",
    integrationType: "OAUTH",
    accessToken: token.access_token,
    refreshToken: token.refresh_token ?? null,
    baseUrl: DISCORD_API_ENDPOINT,
    tokenExpiration,
  }, db);

  await batchInsertDiscordGuild([{
    id: token.guild.id,
    name: token.guild.name,
    icon: token.guild.icon,
    iconHash: token.guild.icon_hash ?? null,
    splash: token.guild.splash,
    discoverySplash: token.guild.discovery_splash,
    owner: token.guild.owner,
    ownerId: token.guild.owner_id,
    permissions: token.guild.permissions,
    region: token.guild.region ?? null,
    afkChannelId: token.guild.afk_channel_id,
    afkTimeout: token.guild.afk_timeout,
    widgetEnabled: token.guild.widget_enabled,
    widgetChannelId: token.guild.widget_channel_id ?? null,
    verificationLevel: token.guild.verification_level,
    defaultMessageNotifications: token.guild.default_message_notifications,
    explicitContentFilter: token.guild.explicit_content_filter,
    roles: token.guild.roles,
    emojis: token.guild.emojis,
    features: token.guild.features,
    mfaLevel: token.guild.mfa_level,
    applicationId: token.guild.application_id,
    systemChannelId: token.guild.system_channel_id,
    systemChannelFlags: token.guild.system_channel_flags,
    rulesChannelId: token.guild.rules_channel_id,
    maxPresences: token.guild.max_presences ?? null,
    maxMembers: token.guild.max_members,
    vanityUrlCode: token.guild.vanity_url_code,
    description: token.guild.description,
    banner: token.guild.banner,
    premiumTier: token.guild.premium_tier,
    premiumSubscriptionCount: token.guild.premium_subscription_count,
    preferredLocale: token.guild.preferred_locale,
    publicUpdatesChannelId: token.guild.public_updates_channel_id,
    maxVideoChannelUsers: token.guild.max_video_channel_users,
    maxStageVideoChannelUsers: token.guild.max_stage_video_channel_users,
    approximateMemberCount: token.guild.approximate_member_count,
    approximatePresenceCount: token.guild.approximate_presence_count,
    welcomeScreen: token.guild.welcome_screen,
    nsfwLevel: token.guild.nsfw_level,
    stickers: token.guild.stickers,
    premiumProgressBarEnabled: token.guild.premium_progress_bar_enabled,
    safetyAlertsChannelId: token.guild.safety_alerts_channel_id,
    incidentsData: token.guild.incidents_data ?? null,
  }], db)

  return Response.redirect(process.env.BUN_PUBLIC_BACKEND_BASE_URL!, 302);
}
