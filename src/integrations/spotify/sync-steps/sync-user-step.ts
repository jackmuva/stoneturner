import { upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import type { SqliteDb } from "@/core/models/db-models";
import type { SpotifyUserProfile } from "../models/models";
import { spotifyFetch } from "./spotify-utils";

const STEP = "spotify-sync-user";

export const syncSpotifyUserStep = async (db: SqliteDb): Promise<SpotifyUserProfile | undefined> => {
  try {
    const user = await retry(async () => {
      const res = await spotifyFetch("/me", db);
      if (!res.ok) throw new Error(await res.text());
      return await res.json() as SpotifyUserProfile;
    }, 3, 1);

    await upsertSyncTask({
      integration: "spotify",
      status: "SUCCESS",
      step: STEP,
      inputs: { userId: user.id, country: user.country },
    }, db);

    return user;
  } catch (e) {
    await upsertSyncTask({
      integration: "spotify",
      status: "FAILED",
      step: STEP,
      inputs: { error: String(e) },
    }, db);
    return undefined;
  }
};
