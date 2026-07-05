import {
  getSlackAccessToken,
  slackApiBottleneck,
  slackApiFetch,
} from "./slack-utils";
import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE } from "@/lib/constants";
import { batchInsertSlackUser, getSlackTeams as getSlackTeamsFromDb } from "../db/queries";
import type { SlackTeamSelect } from "../db/schema";
import type { SqliteDb } from "@/core/models/db-models";
import type { SlackUsersListResponse } from "../models/models";

export type SlackUsersCursor = { teamId: string; cursor?: string };

export const syncUsers = async (db: SqliteDb, cursor?: SlackUsersCursor) => {
  let offset = 0;
  let teams: SlackTeamSelect[] = await getSlackTeamsFromDb(offset, db);

  while (teams.length > 0) {
    const workerQueue = cursor
      ? teams.filter((team) => team.id === cursor.teamId)
      : teams;

    await Promise.allSettled(workerQueue.map((team) =>
      slackApiBottleneck.schedule(() =>
        upsertUsersForTeam(
          team,
          db,
          cursor?.teamId === team.id ? cursor.cursor : undefined,
          Boolean(cursor),
        )
      )
    ));

    if (cursor) break;
    if (teams.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    teams = await getSlackTeamsFromDb(offset, db);
  }
};

const upsertUsersForTeam = async (
  team: SlackTeamSelect,
  db: SqliteDb,
  startCursor?: string,
  singleIteration = false,
): Promise<void> => {
  let nextCursor: string | undefined = startCursor;

  while (true) {
    try {
      const token = await getSlackAccessToken(db);
      const response = await retry(async () =>
        slackApiFetch<SlackUsersListResponse>("users.list", token, {
          limit: 200,
          cursor: nextCursor,
        }));

      const users = response.members;
      if (users.length > 0) {
        await batchInsertSlackUser(users.map((user) => ({
          id: user.id,
          teamId: team.id,
          name: user.name,
          realName: user.real_name ?? user.profile?.real_name ?? null,
          displayName: user.profile?.display_name ?? null,
          isBot: user.is_bot ?? false,
          deleted: user.deleted ?? false,
        })), db);
      }

      const apiNextCursor = response.response_metadata?.next_cursor || undefined;
      if (!apiNextCursor) {
        await upsertSyncTask({
          integration: "slack",
          status: "SUCCESS",
          step: "slack-sync-users",
          inputs: JSON.stringify({ teamId: team.id, userCount: users.length }),
        }, db);
        return;
      }

      nextCursor = apiNextCursor;
      await upsertSyncTask({
        integration: "slack",
        status: "SUCCESS",
        step: "slack-sync-users",
        inputs: JSON.stringify({ teamId: team.id, cursor: nextCursor }),
      }, db);

      if (singleIteration) return;
    } catch (e) {
      await upsertSyncTask({
        integration: "slack",
        status: "FAILED",
        step: "slack-sync-users",
        inputs: JSON.stringify({ teamId: team.id, cursor: nextCursor, error: String(e) }),
      }, db);
      return;
    }
  }
};
