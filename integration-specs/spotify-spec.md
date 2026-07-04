# Authentication

OAuth App — user authorizes via browser redirect (Authorization Code flow).

Stoneturner runs server-side with a stored client secret, so we use the standard Authorization Code flow (not PKCE). Redirect URI must exactly match the value registered in the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard).

Store `BUN_PUBLIC_SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as integration env vars.

## Scopes

| Scope | Purpose |
|-------|---------|
| `playlist-read-private` | Read the user's private playlists and playlist items |
| `playlist-read-collaborative` | Read collaborative playlists the user follows |
| `user-library-read` | Read saved tracks (`/me/tracks`) and saved shows (`/me/shows`) |
| `user-read-email` | Identify the connected Spotify account |

# OAuth Endpoints

Base auth host: `https://accounts.spotify.com`

## Authorization URL

```
GET https://accounts.spotify.com/authorize
  ?client_id={client_id}
  &response_type=code
  &redirect_uri={redirect_uri}
  &scope=playlist-read-private%20playlist-read-collaborative%20user-library-read%20user-read-email
  &state={optional_state}
```

## Access Token Exchange

```
POST https://accounts.spotify.com/api/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64({client_id}:{client_secret})

grant_type=authorization_code
&code={code}
&redirect_uri={redirect_uri}
```

Response:

```json
{
  "access_token": "...",
  "token_type": "Bearer",
  "scope": "playlist-read-private playlist-read-collaborative user-library-read user-read-email",
  "expires_in": 3600,
  "refresh_token": "..."
}
```

## Refresh Token

```
POST https://accounts.spotify.com/api/token
Content-Type: application/x-www-form-urlencoded
Authorization: Basic base64({client_id}:{client_secret})

grant_type=refresh_token
&refresh_token={refresh_token}
```

Access tokens expire after ~1 hour. Spotify may rotate the refresh token in the response.

# API Base

```
https://api.spotify.com/v1
```

All requests use `Authorization: Bearer {access_token}`.

Pagination: most list endpoints accept `limit` (max 50) and `offset`. Prefer manual offset pagination over following `next` URLs — Spotify's `/me/playlists` `next` field has been known to point at deprecated `/users/{id}/playlists` paths.

Rate limits: 429 responses include a `Retry-After` header. Wrap requests in `retry()` and throttle via a Bottleneck limiter.

# Sync Data Sources

## Playlists

List playlists owned or followed by the current user:

```
GET /me/playlists?limit=50&offset=0
```

Scopes: `playlist-read-private`, `playlist-read-collaborative`

Response items are simplified playlist objects with `id`, `name`, `description`, `owner`, `public`, `collaborative`, `snapshot_id`, and `tracks.total`.

**Incremental:** compare `snapshot_id` against stored value; only re-fetch items for playlists whose snapshot changed.

## Playlist Items

```
GET /playlists/{playlist_id}/items?limit=50&offset=0&additional_types=track,episode
```

Scope: `playlist-read-private`

Each item includes `added_at`, `track` (or `episode`), and `type`. Tracks include `name`, `artists`, `album`, `duration_ms`, and `external_urls.spotify`. Episodes include `name`, `description`, `show`, `release_date`, and `duration_ms`.

**Artifact:** One markdown artifact per playlist — title, description, owner, and a numbered list of tracks/episodes with artists, album/show, and Spotify links.

## Saved Tracks (Liked Songs)

```
GET /me/tracks?limit=50&offset=0
```

Scope: `user-library-read`

Each item includes `added_at` and a full `track` object.

**Incremental:** stop paginating once `added_at` is older than the latest stored `addedAt` watermark.

**Artifact:** One markdown artifact per saved track — title, artists, album, release date, duration, explicit flag, and Spotify link.

## Saved Shows (Podcasts)

```
GET /me/shows?limit=50&offset=0
```

Scope: `user-library-read`

Each item includes `added_at` and a `show` object with `id`, `name`, `description`, `publisher`, and `total_episodes`.

**Incremental:** stop when `added_at` is older than the latest stored show watermark.

## Show Episodes

For each saved show, fetch catalog episodes:

```
GET /shows/{show_id}/episodes?limit=50&offset=0
```

Scope: `user-library-read` (user token required for market-aware availability)

Paginate until all episodes are retrieved (increment `offset` by 50).

**Artifact:** One markdown artifact per episode — show name, episode title, description, release date, duration, and Spotify link.

# Sync Pipeline

```
sync-playlists → sync-playlist-tracks → sync-saved-tracks → sync-shows → sync-episodes → parse → index-vector
```

Each sync step accepts an optional **cursor** for resuming failed runs. The cursor is stored in `syncTask.inputs` on SUCCESS (next cursor when more pages remain) and FAILED (cursor at the failure point).

| Step | Cursor type | Example |
|------|-------------|---------|
| `spotify-sync-playlists` | offset (`number`) | `{ "cursor": 50 }` |
| `spotify-sync-playlist-tracks` | `{ playlistId, offset }` | `{ "cursor": { "playlistId": "abc", "offset": 50 } }` |
| `spotify-sync-saved-tracks` | offset (`number`) | `{ "cursor": 100 }` |
| `spotify-sync-shows` | offset (`number`) | `{ "cursor": 50 }` |
| `spotify-sync-episodes` | `{ showId, offset }` | `{ "cursor": { "showId": "xyz", "offset": 50 } }` |
| `parse` | `{ type, offset }` | `{ "cursor": { "type": "playlist", "offset": 20 } }` |

When a cursor is passed to a step, it processes one batch and stops (retry mode). Without a cursor, the step runs until completion.

- `sync-playlists` and `sync-saved-tracks` / `sync-shows` can run in parallel after credentials exist; playlist tracks depend on playlist rows; episodes depend on show rows.
- `parse` renders markdown and runs the summarization LLM to extract `keyPoints`, `questionsAnswered`, and `entities`.
- `index-vector` is the shared Stoneturner step — do not fork it.

# Developer Setup

1. Create an app at https://developer.spotify.com/dashboard
2. Add redirect URI: `{BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/spotify`
3. Set env vars:
   - `BUN_PUBLIC_SPOTIFY_CLIENT_ID`
   - `SPOTIFY_CLIENT_SECRET`
4. Connect via the Stoneturner UI (Knowledge Base → Spotify → Connect)
5. Trigger sync: `POST /api/sync/spotify`
