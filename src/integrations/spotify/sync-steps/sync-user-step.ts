import { upsertSyncTask } from "@/core/db/queries/queries";
import { withSyncTaskId } from "@/core/services/retry-cron";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import type { SpotifyUserProfile } from "../models/models";
import { spotifyFetch } from "./spotify-utils";

const STEP = "spotify-sync-user";

export const syncSpotifyUserStep = async (db: SqliteDb, syncTaskId?: string): Promise<SpotifyUserProfile | undefined> => {
  try {
    const user = await retry(async () => {
      const res = await spotifyFetch("/me", db);
      if (!res.ok) throw new Error(await res.text());
      return await res.json() as SpotifyUserProfile;
    });

    await upsertSyncTask(withSyncTaskId({
      integration: "spotify",
      status: "SUCCESS",
      step: STEP,
    }, syncTaskId), db);

    return user;
  } catch (e) {
    await upsertSyncTask(withSyncTaskId({
      integration: "spotify",
      status: "FAILED",
      step: STEP,
      error: String(e),
    }, syncTaskId), db);
    return undefined;
  }
};
