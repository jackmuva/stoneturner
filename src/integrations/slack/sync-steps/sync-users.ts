import type { SlackUser } from "../models/models";
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

export const syncUsers = async (db: SqliteDb) => {
  let offset = 0;
  let teams: SlackTeamSelect[] = await getSlackTeamsFromDb(offset, db);

  while (teams.length > 0) {
    await Promise.allSettled(teams.map((team) =>
      slackApiBottleneck.schedule(() => upsertUsersForTeam(team, db))
    ));

    if (teams.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
    teams = await getSlackTeamsFromDb(offset, db);
  }
};

const upsertUsersForTeam = async (team: SlackTeamSelect, db: SqliteDb): Promise<void> => {
  try {
    const token = await getSlackAccessToken(db);
    const users = await retry(async () => fetchAllUsers(token), 3, 1);
    if (users.length === 0) return;

    await batchInsertSlackUser(users.map((user) => ({
      id: user.id,
      teamId: team.id,
      name: user.name,
      realName: user.real_name ?? user.profile?.real_name ?? null,
      displayName: user.profile?.display_name ?? null,
      isBot: user.is_bot ?? false,
      deleted: user.deleted ?? false,
    })), db);

    await upsertSyncTask({
      integration: "slack",
      status: "SUCCESS",
      step: "slack-sync-users",
      inputs: JSON.stringify({ teamId: team.id, userCount: users.length }),
    }, db);
  } catch (e) {
    await upsertSyncTask({
      integration: "slack",
      status: "FAILED",
      step: "slack-sync-users",
      inputs: JSON.stringify({ teamId: team.id, error: String(e) }),
    }, db);
  }
};

const fetchAllUsers = async (token: string): Promise<SlackUser[]> => {
  const users: SlackUser[] = [];
  let cursor: string | undefined;

  do {
    const response = await slackApiFetch<SlackUsersListResponse>("users.list", token, {
      limit: 200,
      cursor,
    });
    users.push(...response.members);
    cursor = response.response_metadata?.next_cursor || undefined;
  } while (cursor);

  return users;
};
