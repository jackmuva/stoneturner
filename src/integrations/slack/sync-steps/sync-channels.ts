import {
  getSlackAccessToken,
  slackApiBottleneck,
  slackApiFetch,
} from "./slack-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/integrations/retry-step-utils";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertSlackChannel, getSlackTeams as getSlackTeamsFromDb } from "../db/queries";
import type { SlackTeamSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";
import type { SlackConversationsListResponse } from "../models/models";

export type SlackChannelsCursor = { teamId: string; cursor?: string };

export const syncChannels = async (db: SqliteDb, cursor?: SlackChannelsCursor, syncTaskId?: string) => {
  let offset = 0;
  let teams: SlackTeamSelect[] = await getSlackTeamsFromDb(offset, db);

  while (teams.length > 0) {
    const workerQueue = cursor
      ? teams.filter((team) => team.id === cursor.teamId)
      : teams;

    await Promise.allSettled(workerQueue.map((team) =>
      slackApiBottleneck.schedule(() =>
        upsertChannelsForTeam(
          team,
          db,
          cursor?.teamId === team.id ? cursor.cursor : undefined,
          Boolean(cursor),
          syncTaskId,
        )
      )
    ));

    if (cursor) break;
    if (teams.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    teams = await getSlackTeamsFromDb(offset, db);
  }
};

const upsertChannelsForTeam = async (
  team: SlackTeamSelect,
  db: SqliteDb,
  startCursor?: string,
  singleIteration = false,
  syncTaskId?: string,
): Promise<void> => {
  let nextCursor: string | undefined = startCursor;

  while (true) {
    try {
      const token = await getSlackAccessToken(db);
      const response = await retry(async () =>
        slackApiFetch<SlackConversationsListResponse>("conversations.list", token, {
          types: "public_channel",
          exclude_archived: true,
          limit: 200,
          cursor: nextCursor,
        }));

      const channels = response.channels
        .filter((channel) => !channel.is_private && !channel.is_archived);

      if (channels.length > 0) {
        await batchInsertSlackChannel(channels.map((channel) => ({
          id: channel.id,
          teamId: team.id,
          name: channel.name,
          topic: channel.topic?.value ?? null,
          purpose: channel.purpose?.value ?? null,
          numMembers: channel.num_members ?? null,
          isArchived: channel.is_archived ?? false,
          created: channel.created ?? null,
        })), db);
      }

      const apiNextCursor = response.response_metadata?.next_cursor || undefined;
      if (!apiNextCursor) {
        await upsertSyncTask(withSyncTaskId({
          integration: "slack",
          status: "SUCCESS",
          step: "slack-sync-channels",
          inputs: JSON.stringify({ teamId: team.id }),
        }, syncTaskId), db);
        return;
      }

      nextCursor = apiNextCursor;
      await upsertSyncTask(withSyncTaskId({
        integration: "slack",
        status: "SUCCESS",
        step: "slack-sync-channels",
        inputs: JSON.stringify({ teamId: team.id, cursor: nextCursor }),
      }, syncTaskId), db);

      if (singleIteration) return;
    } catch (e) {
      await upsertSyncTask(withSyncTaskId({
        integration: "slack",
        status: "FAILED",
        step: "slack-sync-channels",
        inputs: JSON.stringify({ teamId: team.id, cursor: nextCursor }),
        error: String(e),
      }, syncTaskId), db);
      return;
    }
  }
};
