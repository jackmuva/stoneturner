import type { SlackChannel } from "../models/models";
import {
  getSlackAccessToken,
  slackApiBottleneck,
  slackApiFetch,
} from "./slack-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertSlackChannel, getSlackTeams as getSlackTeamsFromDb } from "../db/queries";
import type { SlackTeamSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";
import type { SlackConversationsListResponse } from "../models/models";

export const syncChannels = async (db: SqliteDb) => {
  let offset = 0;
  let teams: SlackTeamSelect[] = await getSlackTeamsFromDb(offset, db);

  while (teams.length > 0) {
    await Promise.allSettled(teams.map((team) =>
      slackApiBottleneck.schedule(() => upsertChannelsForTeam(team, db))
    ));

    if (teams.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    teams = await getSlackTeamsFromDb(offset, db);
  }
};

const upsertChannelsForTeam = async (team: SlackTeamSelect, db: SqliteDb): Promise<void> => {
  try {
    const token = await getSlackAccessToken(db);
    const channels = await retry(async () => fetchAllPublicChannels(token), 3, 1);
    if (channels.length === 0) return;

    await batchInsertSlackChannel(channels
      .filter((channel) => !channel.is_private && !channel.is_archived)
      .map((channel) => ({
        id: channel.id,
        teamId: team.id,
        name: channel.name,
        topic: channel.topic?.value ?? null,
        purpose: channel.purpose?.value ?? null,
        numMembers: channel.num_members ?? null,
        isArchived: channel.is_archived ?? false,
        created: channel.created ?? null,
      })), db);

    await upsertSyncTask({
      integration: "slack",
      status: "SUCCESS",
      step: "slack-sync-channels",
      inputs: JSON.stringify({ teamId: team.id, channelCount: channels.length }),
    }, db);
  } catch (e) {
    await upsertSyncTask({
      integration: "slack",
      status: "FAILED",
      step: "slack-sync-channels",
      inputs: JSON.stringify({ teamId: team.id, error: String(e) }),
    }, db);
  }
};

const fetchAllPublicChannels = async (token: string): Promise<SlackChannel[]> => {
  const channels: SlackChannel[] = [];
  let cursor: string | undefined;

  do {
    const response = await slackApiFetch<SlackConversationsListResponse>("conversations.list", token, {
      types: "public_channel",
      exclude_archived: true,
      limit: 200,
      cursor,
    });
    channels.push(...response.channels);
    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return channels;
};
