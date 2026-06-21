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

export type Attachment = {
  id: string,
  filename: string,
  title?: string | null,
  description?: string | null,
  contentType?: string,
  size: number,
  url: string,
  proxyUrl: string,
  height?: number | null,
  width?: number | null,
  ephemeral?: boolean,
  durationSecs?: number,
  placeholder?: string,
  placeholderLength?: number,
}

export type Embed = {
  title?: string | null,
  type?: string,
  description?: string | null,
  url?: string,
  timestamp?: string,
  color?: number,
  footer?: {
    text: string,
    iconUrl?: string,
    proxyIconUrl?: string,
  },
  image?: {
    url: string,
    proxyUrl?: string,
    height?: number,
    width?: number,
  },
  thumbnail?: {
    url: string,
    proxyUrl?: string,
    height?: number,
    width?: number,
  },
  video?: {
    url: string,
    proxyUrl?: string,
    height?: number,
    width?: number,
  },
  provider?: {
    name?: string,
    url?: string,
  },
  author?: {
    name?: string,
    url?: string,
    iconUrl?: string,
    proxyIconUrl?: string,
  },
  fields?: Array<{
    name: string,
    value: string,
    inline?: boolean,
  }>,
}

export type Reaction = {
  count: number,
  countDetails?: {
    burst: number,
    normal: number,
  },
  me: boolean,
  meBurst?: boolean,
  emoji: {
    id: string | null,
    name: string | null,
    animated?: boolean,
  },
  burstColors?: string[],
}

export type ChannelMention = {
  id: string,
  guildId: string,
  type: number,
  name: string,
}

export type MessageReference = {
  type?: number,
  guildId?: string,
  channelId?: string,
  messageId?: string,
  failIfNotExists?: boolean,
}

export type MessageSnapshot = {
  message: {
    id: string,
    channelId: string,
    guildId?: string,
    author: User,
    content: string,
    timestamp: string,
    editedTimestamp?: string | null,
    tts: boolean,
    mentionEveryone: boolean,
    mentions: User[],
    mentionRoles: string[],
    pinned: boolean,
    type: number,
  },
}

export type MessageActivity = {
  type: number,
  party_id?: string,
}

export type PartialApplication = {
  id: string,
  name: string,
  icon: string | null,
  description: string,
  bot?: User,
}

export type MessageInteractionMetadata = {
  id: string,
  type: number,
  name: string,
  user: User,
  authorizingIntegrationsApps?: Array<{
    id: string,
    type: number,
    name: string,
    icon: string | null,
    description: string,
    bot?: User,
  }>,
  originalResponseMessageId?: string,
  triggeringMessageId?: string,
  interactionMetadata?: MessageInteractionMetadata,
}

export type MessageInteraction = {
  id: string,
  type: number,
  name: string,
  user: User,
  properties?: {
    sessionId?: string,
    continuation?: boolean,
    namingStrategy?: string,
  },
}

export type MessageComponent = {
  type: number,
  style?: number,
  label?: string,
  emoji?: {
    id: string | null,
    name: string | null,
    animated?: boolean,
  },
  custom_id?: string,
  url?: string,
  disabled?: boolean,
  components?: MessageComponent[],
}

export type StickerItem = {
  id: string,
  name: string,
  format_type: number,
}

export type Sticker = {
  id: string,
  name: string,
  description: string | null,
  tags?: string,
  formatType: number,
  type: number,
  available?: boolean,
  guildId?: string,
  user?: User,
  sortValue?: number,
}

export type RoleSubscriptionData = {
  roleSubscriptionListingId: string,
  tierName: string,
  totalMonthsSubscribed: number,
  isRenewal: boolean,
}

export type ResolvedData = {
  users?: Record<string, User>,
  members?: Record<string, {
    roles: string[],
    nick?: string | null,
    avatar?: string | null,
    deaf?: boolean,
    mute?: boolean,
    joinedAt: string,
    flags: number,
    isPending?: boolean,
    communicationDisabledUntil?: string | null,
  }>,
  channels?: Record<string, {
    id: string,
    type: number,
    name: string,
    permissions: string,
  }>,
  roles?: Record<string, {
    id: string,
    name: string,
    permissions: string,
    color: number,
    hoist: boolean,
    icon?: string | null,
    unicodeEmoji?: string | null,
    position: number,
    flags: number,
    mentionable: boolean,
  }>,
  stickers?: Record<string, Sticker>,
  messages?: Record<string, {
    id: string,
    channelId: string,
    guildId?: string,
    author: User,
    content: string,
    timestamp: string,
    editedTimestamp?: string | null,
  }>,
  reactions?: Record<string, {
    count: number,
    me: boolean,
    emoji: {
      id: string | null,
      name: string | null,
      animated?: boolean,
    },
  }>,
}

export type Poll = {
  question: {
    text: string,
    answers: Array<{
      text: string,
      emoji?: {
        id: string | null,
        name: string | null,
        animated?: boolean,
      },
    }>,
  },
  expiry: string,
  layoutProperties?: {
    type: number,
    allowMultiselect: boolean,
    minValues?: number,
    maxValues?: number,
    questionDuration?: number,
  },
  results?: {
    isFinalized: boolean,
    answerCounts: Array<{
      id: number,
      count: number,
      meVoted: boolean,
    }>,
  },
  isExpired?: boolean,
  totalVoteCount?: number,
}

export type MessageCall = {
  participants: string[],
  is_ended?: boolean,
  quality_modifier?: number,
  ring_time?: number,
}

export type SharedClientTheme = {
  theme?: string,
}

export type DiscordMessage = {
  id: string,
  channel_id: string,
  author: User,
  content: string,
  timestamp: string,
  edited_timestamp: string | null,
  tts: boolean,
  mention_everyone: boolean,
  mentions: User[],
  mention_roles: string[],
  mention_channels?: ChannelMention[],
  attachments: Attachment[],
  embeds: Embed[],
  reactions?: Reaction[],
  nonce?: number | string,
  pinned: boolean,
  webhook_id?: string,
  type: number,
  activity?: MessageActivity,
  application?: PartialApplication,
  application_id?: string,
  flags?: number,
  message_reference?: MessageReference,
  message_snapshots?: MessageSnapshot[],
  referenced_message?: {
    message_id: string,
  },
  interaction_metadata?: MessageInteractionMetadata,
  interaction?: MessageInteraction,
  thread?: DiscordChannel,
  components?: MessageComponent[],
  sticker_items?: StickerItem[],
  stickers?: Sticker[],
  position?: number,
  role_subscription_data?: RoleSubscriptionData,
  resolved?: ResolvedData,
  poll?: Poll,
  call?: MessageCall,
  shared_client_theme?: SharedClientTheme,
}

export type Role = {
  id: string,
  name: string,
  permissions: string,
  color: number,
  hoist: boolean,
  icon?: string | null,
  unicode_emoji?: string | null,
  position: number,
  managed: boolean,
  mentionable: boolean,
  flags: number,
}

export type Emoji = {
  id: string,
  name: string | null,
  roles?: string[],
  user?: User,
  require_colons?: boolean,
  managed?: boolean,
  animated?: boolean,
  available?: boolean,
}

export type WelcomeScreen = {
  description: string | null,
  welcome_channels: Array<{
    channel_id: string,
    description: string,
    emoji_id: string | null,
    emoji_name: string | null,
  }>,
}

export type IncidentsData = {
  invites_disabled_until?: string | null,
  dm_settings_disabled_until?: string | null,
  dms_disabled_until?: string | null,
}

export type DiscordGuild = {
  id: string,
  name: string,
  icon: string | null,
  icon_hash?: string | null,
  splash: string | null,
  discovery_splash: string | null,
  owner?: boolean,
  owner_id: string,
  permissions?: string,
  region?: string | null,
  afk_channel_id: string | null,
  afk_timeout: number,
  widget_enabled?: boolean,
  widget_channel_id?: string | null,
  verification_level: number,
  default_message_notifications: number,
  explicit_content_filter: number,
  roles: Role[],
  emojis: Emoji[],
  features: string[],
  mfa_level: number,
  application_id: string | null,
  system_channel_id: string | null,
  system_channel_flags: number,
  rules_channel_id: string | null,
  max_presences?: number | null,
  max_members?: number,
  vanity_url_code: string | null,
  description: string | null,
  banner: string | null,
  premium_tier: number,
  premium_subscription_count?: number,
  preferred_locale: string,
  public_updates_channel_id: string | null,
  max_video_channel_users?: number,
  max_stage_video_channel_users?: number,
  approximate_member_count?: number,
  approximate_presence_count?: number,
  welcome_screen?: WelcomeScreen,
  nsfw_level: number,
  stickers?: Sticker[],
  premium_progress_bar_enabled: boolean,
  safety_alerts_channel_id: string | null,
  incidents_data: IncidentsData | null,
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

