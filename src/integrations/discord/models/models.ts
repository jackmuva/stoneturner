export type PartialGuild = {
  id: string,
  name: string,
  icon: string | null,
  banner: string | null,
  owner: boolean,
  permissions: string,
  features: string[],
  approximate_member_count?: number,
  approximate_presence_count?: number,
}

export type Overwrite = {
  id: string,
  type: number,
  allow: string,
  deny: string,
}

export type User = {
  id: string,
  username: string,
  discriminator: string,
  global_name: string | null,
  avatar: string | null,
  bot?: boolean,
  system?: boolean,
  email?: string | null,
}

export type ThreadMetadata = {
  archived: boolean,
  auto_archive_duration: number,
  archive_timestamp: string,
  locked: boolean,
  invitable?: boolean,
  create_timestamp?: string | null,
}

export type ThreadMember = {
  id?: string,
  user_id?: string,
  join_timestamp: string,
  flags: number,
}

export type ForumTag = {
  id: string,
  name: string,
  moderated: boolean,
  emoji_id: string | null,
  emoji_name: string | null,
}

export type DefaultReaction = {
  emoji_id: string | null,
  emoji_name: string | null,
}

export type DiscordChannel = {
  id: string,
  type: number,
  guild_id?: string,
  position?: number,
  permission_overwrites?: Overwrite[],
  name?: string | null,
  topic?: string | null,
  nsfw?: boolean,
  last_message_id?: string | null,
  bitrate?: number,
  user_limit?: number,
  rate_limit_per_user?: number,
  recipients?: User[],
  icon?: string | null,
  owner_id?: string,
  application_id?: string,
  managed?: boolean,
  parent_id?: string | null,
  last_pin_timestamp?: string | null,
  rtc_region?: string | null,
  video_quality_mode?: number,
  message_count?: number,
  member_count?: number,
  thread_metadata?: ThreadMetadata,
  member?: ThreadMember,
  default_auto_archive_duration?: number,
  permissions?: string,
  flags?: number,
  total_message_sent?: number,
  available_tags?: ForumTag[],
  applied_tags?: string[],
  default_reaction_emoji?: DefaultReaction | null,
  default_thread_rate_limit_per_user?: number,
  default_sort_order?: number | null,
  default_forum_layout?: number,
}

