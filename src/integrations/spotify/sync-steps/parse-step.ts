import { getMdArtifactByIntegrationArtifactId, upsertMdArtifact, upsertSyncTask } from "@/core/db/queries/queries";
import { retry } from "@/lib/utils";
import { PAGE_SIZE, SUMMARIZATION_MODEL } from "@/lib/constants";
import { generateText, Output } from "ai";
import * as z from "zod";
import { aiGatewayBottleneck } from "@/core/services/rate-limiter";
import type { SqliteDb } from "@/core/models/db-models";
import {
  getSpotifyEpisodes,
  getSpotifyPlaylistTracks,
  getSpotifyPlaylists,
  getSpotifySavedTracks,
} from "../db/queries";
import type { SpotifyEpisodeSelect, SpotifyPlaylistSelect, SpotifySavedTrackSelect } from "../db/schema";
import { formatDuration, type SpotifyParseCursor } from "./spotify-utils";

export const parseSpotifyStep = async (db: SqliteDb, cursor?: SpotifyParseCursor): Promise<void> => {
  if (!cursor || cursor.type === "playlist") {
    await parsePlaylists(db, cursor?.type === "playlist" ? cursor.offset : undefined);
  }
  if (!cursor || cursor.type === "saved-track") {
    await parseSavedTracks(db, cursor?.type === "saved-track" ? cursor.offset : undefined);
  }
  if (!cursor || cursor.type === "episode") {
    await parseEpisodes(db, cursor?.type === "episode" ? cursor.offset : undefined);
  }
};

const parsePlaylists = async (db: SqliteDb, cursor?: number): Promise<void> => {
  let curOffset = cursor ?? 0;
  let playlists: SpotifyPlaylistSelect[] = [];
  let firstIteration = true;

  while (playlists.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      playlists = await getSpotifyPlaylists(curOffset, db);
      const results = await Promise.allSettled(
        playlists.map((p) => aiGatewayBottleneck.schedule(() => generatePlaylistArtifact(p, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      const nextCursor = curOffset + PAGE_SIZE;
      const hasMore = playlists.length >= PAGE_SIZE;
      await upsertSyncTask({
        integration: "spotify",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length
          ? { cursor: { type: "playlist", offset: curOffset }, errors: failures }
          : hasMore
            ? { cursor: { type: "playlist", offset: nextCursor } }
            : { type: "playlist" },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        inputs: { cursor: { type: "playlist", offset: curOffset }, error: String(e) },
        step: "parse",
      }, db);
    }

    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const parseSavedTracks = async (db: SqliteDb, cursor?: number): Promise<void> => {
  let curOffset = cursor ?? 0;
  let tracks: SpotifySavedTrackSelect[] = [];
  let firstIteration = true;

  while (tracks.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      tracks = await getSpotifySavedTracks(curOffset, db);
      const results = await Promise.allSettled(
        tracks.map((t) => aiGatewayBottleneck.schedule(() => generateSavedTrackArtifact(t, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      const nextCursor = curOffset + PAGE_SIZE;
      const hasMore = tracks.length >= PAGE_SIZE;
      await upsertSyncTask({
        integration: "spotify",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length
          ? { cursor: { type: "saved-track", offset: curOffset }, errors: failures }
          : hasMore
            ? { cursor: { type: "saved-track", offset: nextCursor } }
            : { type: "saved-track" },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        inputs: { cursor: { type: "saved-track", offset: curOffset }, error: String(e) },
        step: "parse",
      }, db);
    }

    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const parseEpisodes = async (db: SqliteDb, cursor?: number): Promise<void> => {
  let curOffset = cursor ?? 0;
  let episodes: SpotifyEpisodeSelect[] = [];
  let firstIteration = true;

  while (episodes.length > 0 || firstIteration) {
    firstIteration = false;
    try {
      episodes = await getSpotifyEpisodes(curOffset, db);
      const results = await Promise.allSettled(
        episodes.map((e) => aiGatewayBottleneck.schedule(() => generateEpisodeArtifact(e, db))),
      );
      const failures = results
        .filter((r) => r.status === "rejected")
        .map((r) => String((r as PromiseRejectedResult).reason));

      const nextCursor = curOffset + PAGE_SIZE;
      const hasMore = episodes.length >= PAGE_SIZE;
      await upsertSyncTask({
        integration: "spotify",
        status: failures.length ? "FAILED" : "SUCCESS",
        inputs: failures.length
          ? { cursor: { type: "episode", offset: curOffset }, errors: failures }
          : hasMore
            ? { cursor: { type: "episode", offset: nextCursor } }
            : { type: "episode" },
        step: "parse",
      }, db);
    } catch (e) {
      await upsertSyncTask({
        integration: "spotify",
        status: "FAILED",
        inputs: { cursor: { type: "episode", offset: curOffset }, error: String(e) },
        step: "parse",
      }, db);
    }

    if (cursor !== undefined) break;
    curOffset += PAGE_SIZE;
  }
};

const generatePlaylistArtifact = async (playlist: SpotifyPlaylistSelect, db: SqliteDb): Promise<void> => {
  const tracks = await getSpotifyPlaylistTracks(playlist.playlistId, db);
  const md: string[] = [];
  md.push(`# Playlist: ${playlist.name ?? "Untitled Playlist"}\n\n`);

  if (playlist.description) md.push(`${playlist.description}\n\n`);
  if (playlist.ownerDisplayName) md.push(`**Owner:** ${playlist.ownerDisplayName}\n\n`);
  if (playlist.spotifyUrl) md.push(`**Spotify:** ${playlist.spotifyUrl}\n\n`);

  md.push(`## Tracks (${tracks.length})\n\n`);
  tracks.forEach((track, index) => {
    const artists = track.artists ? ` — ${track.artists}` : "";
    const album = track.albumOrShow ? ` (${track.albumOrShow})` : "";
    const duration = track.durationMs ? ` [${formatDuration(track.durationMs)}]` : "";
    md.push(`${index + 1}. **${track.name ?? "Unknown"}**${artists}${album}${duration}\n`);
    if (track.spotifyUrl) md.push(`   ${track.spotifyUrl}\n`);
    md.push("\n");
  });

  const markdown = md.join("");
  const artifactId = `playlist:${playlist.playlistId}`;
  const existing = await getMdArtifactByIntegrationArtifactId(artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following Spotify playlist and extract:
1. KEY POINTS: Themes, genres, moods, and notable patterns in the track selection.
2. QUESTIONS ANSWERED: What kinds of listening contexts or moods does this playlist serve?
3. ENTITIES: Artists, albums, podcasts, genres, and other notable names.

Playlist:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: artifactId,
    integration: "spotify",
    artifactDate: undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};

const generateSavedTrackArtifact = async (track: SpotifySavedTrackSelect, db: SqliteDb): Promise<void> => {
  const md: string[] = [];
  md.push(`# Track: ${track.name ?? "Unknown Track"}\n\n`);
  if (track.artists) md.push(`**Artists:** ${track.artists}\n\n`);
  if (track.albumName) md.push(`**Album:** ${track.albumName}\n\n`);
  if (track.albumReleaseDate) md.push(`**Release Date:** ${track.albumReleaseDate}\n\n`);
  if (track.durationMs) md.push(`**Duration:** ${formatDuration(track.durationMs)}\n\n`);
  if (track.explicit) md.push(`**Explicit:** Yes\n\n`);
  if (track.addedAt) md.push(`**Saved:** ${track.addedAt}\n\n`);
  if (track.spotifyUrl) md.push(`**Spotify:** ${track.spotifyUrl}\n\n`);

  const markdown = md.join("");
  const artifactId = `track:${track.trackId}`;
  const existing = await getMdArtifactByIntegrationArtifactId(artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following saved Spotify track metadata and extract:
1. KEY POINTS: Musical style, themes, and why someone might save this track.
2. QUESTIONS ANSWERED: What does this track represent in a user's library?
3. ENTITIES: Artists, albums, genres, and related names.

Track:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: artifactId,
    integration: "spotify",
    artifactDate: track.addedAt ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};

const generateEpisodeArtifact = async (episode: SpotifyEpisodeSelect, db: SqliteDb): Promise<void> => {
  const md: string[] = [];
  md.push(`# Episode: ${episode.name ?? "Unknown Episode"}\n\n`);
  if (episode.showName) md.push(`**Show:** ${episode.showName}\n\n`);
  if (episode.releaseDate) md.push(`**Release Date:** ${episode.releaseDate}\n\n`);
  if (episode.durationMs) md.push(`**Duration:** ${formatDuration(episode.durationMs)}\n\n`);
  if (episode.description) md.push(`## Description\n\n${episode.description}\n\n`);
  if (episode.spotifyUrl) md.push(`**Spotify:** ${episode.spotifyUrl}\n\n`);

  const markdown = md.join("");
  const artifactId = `episode:${episode.episodeId}`;
  const existing = await getMdArtifactByIntegrationArtifactId(artifactId, db);
  if (existing && existing.markdown === markdown) return;

  const { output: analysis } = await retry(async () => await generateText({
    model: SUMMARIZATION_MODEL,
    prompt: `Analyze the following Spotify podcast episode and extract:
1. KEY POINTS: Main topics, themes, and takeaways from the episode description.
2. QUESTIONS ANSWERED: What questions or topics does this episode address?
3. ENTITIES: People, companies, topics, and other notable names mentioned.

Episode:
${markdown}`,
    output: Output.object({
      schema: z.object({
        keyPoints: z.array(z.string()),
        questionsAnswered: z.array(z.string()),
        entities: z.array(z.string()),
      }),
    }),
  }), 3, 1);

  await upsertMdArtifact({
    integrationArtifactId: artifactId,
    integration: "spotify",
    artifactDate: episode.releaseDate ?? undefined,
    markdown,
    keyPoints: analysis.keyPoints,
    questionsAnswered: analysis.questionsAnswered,
    entities: analysis.entities,
  }, db);
};
