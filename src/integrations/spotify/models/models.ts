export type SpotifyUserProfile = {
  id: string;
  country?: string;
  email?: string;
};

export type SpotifyTokenResponse = {
  access_token: string;
  token_type: string;
  scope: string;
  expires_in: number;
  refresh_token?: string;
};

export type SpotifyPaginatedResponse<T> = {
  href: string;
  limit: number;
  next: string | null;
  offset: number;
  previous: string | null;
  total: number;
  items: T[];
};

export type SpotifyImage = {
  url: string;
  height: number | null;
  width: number | null;
};

export type SpotifyExternalUrls = {
  spotify?: string;
};

export type SpotifyArtist = {
  id: string;
  name: string;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyAlbum = {
  id: string;
  name: string;
  release_date?: string;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyTrack = {
  id: string;
  name: string;
  type: "track";
  duration_ms: number;
  explicit: boolean;
  external_urls?: SpotifyExternalUrls;
  artists: SpotifyArtist[];
  album?: SpotifyAlbum;
  is_local?: boolean;
};

export type SpotifyEpisode = {
  id: string;
  name: string;
  type: "episode";
  description?: string;
  html_description?: string;
  release_date?: string;
  duration_ms: number;
  explicit: boolean;
  external_urls?: SpotifyExternalUrls;
  show?: {
    id: string;
    name: string;
    publisher?: string;
  };
};

export type SpotifySavedTrackItem = {
  added_at: string;
  track: SpotifyTrack | null;
};

export type SpotifyPlaylistOwner = {
  id: string;
  display_name?: string;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifyPlaylist = {
  id: string;
  name: string;
  description: string | null;
  collaborative: boolean;
  public: boolean | null;
  snapshot_id: string;
  external_urls?: SpotifyExternalUrls;
  owner: SpotifyPlaylistOwner;
  items: {
    href: string;
    total: number;
  };
  /** @deprecated Spotify recommends `items` instead */
  tracks?: {
    href: string;
    total: number;
  };
};

export type SpotifyPlaylistItem = {
  added_at: string;
  track: SpotifyTrack | SpotifyEpisode | null;
};

export type SpotifyShow = {
  id: string;
  name: string;
  description: string;
  html_description?: string;
  publisher: string;
  total_episodes: number;
  explicit: boolean;
  external_urls?: SpotifyExternalUrls;
};

export type SpotifySavedShowItem = {
  added_at: string;
  show: SpotifyShow;
};
