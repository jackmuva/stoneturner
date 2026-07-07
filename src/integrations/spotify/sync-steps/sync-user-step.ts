import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import type { SpotifyUserProfile } from "../models/models";
import { spotifyFetch } from "./spotify-utils";

const STEP = "spotify-sync-user";

export const fetchSpotifyUser = async (db: SqliteDb): Promise<SpotifyUserProfile> => {
  const res = await spotifyFetch("/me", db);
  if (!res.ok) throw new Error(await res.text());
  return await res.json() as SpotifyUserProfile;
};

export const syncSpotifyUserStep = async (
  _incremental: boolean,
  db: SqliteDb,
  _inputs?: unknown,
  syncTaskId?: string,
): Promise<void> => {
  try {
    await retry(() => fetchSpotifyUser(db));
    await upsertSyncTask({
      id: syncTaskId,
      integration: "spotify",
      status: "SUCCESS",
      error: null,
      step: STEP,
    }, db);
  } catch (e) {
    await upsertSyncTask({
      id: syncTaskId,
      integration: "spotify",
      status: "FAILED",
      step: STEP,
      error: String(e),
    }, db);
  }
};
