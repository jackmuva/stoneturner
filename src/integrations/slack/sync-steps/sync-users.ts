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

export type SlackSyncUsersInputs = { teamId: string; cursor?: string };

export const syncUsers = async (_incremental: boolean = true, db: SqliteDb, inputs?: SlackSyncUsersInputs, syncTaskId?: string) => {
  let offset = 0;
  let teams: SlackTeamSelect[] = await getSlackTeamsFromDb(offset, db);

  while (teams.length > 0) {
    const workerQueue = inputs
      ? teams.filter((team) => team.id === inputs.teamId)
      : teams;

    await Promise.allSettled(workerQueue.map((team) =>
      slackApiBottleneck.schedule(() =>
        upsertUsersForTeam(
          team,
          db,
          inputs?.teamId === team.id ? inputs.cursor : undefined,
          Boolean(inputs),
          syncTaskId,
        )
      )
    ));

    if (inputs) break;
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
  syncTaskId?: string,
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
          id: syncTaskId,
          integration: "slack",
          status: "SUCCESS",
          error: null,
          step: "slack-sync-users",
          inputs: { teamId: team.id },
        }, db);
        return;
      }

      nextCursor = apiNextCursor;
      await upsertSyncTask({
        id: syncTaskId,
        integration: "slack",
        status: "SUCCESS",
        error: null,
        step: "slack-sync-users",
        inputs: { teamId: team.id, cursor: nextCursor },
      }, db);

      if (singleIteration) return;
    } catch (e) {
      await upsertSyncTask({
        id: syncTaskId,
        integration: "slack",
        status: "FAILED",
        step: "slack-sync-users",
        inputs: { teamId: team.id, cursor: nextCursor },
        error: String(e),
      }, db);
      return;
    }
  }
};
