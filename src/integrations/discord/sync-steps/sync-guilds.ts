import type { IntegrationCredential } from "@/core/db/schema/schema";
import type { PartialGuild } from "../models/models";
import { DISCORD_API_ENDPOINT, getDiscordCredentials, refreshDiscordTokens } from "./discord-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { batchInsertDiscordGuild } from "../db/queries";
import { retry } from "@/lib/utils";

const GUILD_LIMIT = 200;

export const syncGuilds = async () => {
  let cursor = "";

  while (true) {
    const guilds: PartialGuild[] | null = await retry(async () => {
      return await getNextGuildPage(cursor || undefined);
    }, 3, 1).catch(() => null);

    if (guilds === null) {
      await upsertSyncTask({
        integration: "discord",
        status: "FAILED",
        step: "get-guilds",
        inputs: JSON.stringify({ cursor }),
      })
      return;
    }

    if (guilds.length > 0) {
      await batchInsertDiscordGuild(guilds.map((guild) => {
        return {
          id: guild.id,
          name: guild.name,
          icon: guild.icon,
          banner: guild.banner,
          owner: guild.owner,
          permissions: guild.permissions,
          features: guild.features,
          approximateMemberCount: guild.approximate_member_count,
          approximatePresenceCount: guild.approximate_presence_count,
        }
      }));
    }

    if (guilds.length < GUILD_LIMIT) break;
    cursor = guilds.at(-1)!.id;
  }
  return;
}

export const getNextGuildPage = async (cursor?: string): Promise<PartialGuild[] | null> => {
  const discordCred: IntegrationCredential | null = await getDiscordCredentials();
  if (!discordCred) return null;

  const params = new URLSearchParams({
    with_counts: "true",
    limit: String(GUILD_LIMIT),
  });
  if (cursor) params.set("after", cursor);

  const guildRes = await fetch(`${DISCORD_API_ENDPOINT}/users/@me/guilds?${params}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${discordCred.accessToken}`
    },
  });

  if (!guildRes.ok) {
    await refreshDiscordTokens();
    throw new Error(`discord get guilds failed: ${guildRes.status}`);
  };

  const guildList: PartialGuild[] = await guildRes.json()
  return guildList;
}
