import type { IntegrationConfig } from "@/core/models/models";

const SPOTIFY_SCOPES = [
  "playlist-read-private",
  "playlist-read-collaborative",
  "user-library-read",
  "user-read-email",
  "user-read-private",
].join(" ");

export const spotifyConfig: IntegrationConfig = {
  integration: "spotify",
  icon: "/assets/spotify.png",
  integrationType: "OAUTH",
  description: "Connect Spotify via OAuth to sync playlists, saved tracks, and podcast episodes.",
  oauthAuthorizationUrl: `https://accounts.spotify.com/authorize?client_id=${process.env.BUN_PUBLIC_SPOTIFY_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/spotify`)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}`,
};
