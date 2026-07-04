export type SlackTopic = {
  value: string;
  creator: string;
  last_set: number;
};

export type SlackPurpose = {
  value: string;
  creator: string;
  last_set: number;
};

export type SlackChannel = {
  id: string;
  name: string;
  is_channel?: boolean;
  is_group?: boolean;
  is_im?: boolean;
  is_mpim?: boolean;
  is_private?: boolean;
  is_archived?: boolean;
  is_member?: boolean;
  num_members?: number;
  topic?: SlackTopic;
  purpose?: SlackPurpose;
  created?: number;
};

export type SlackUserProfile = {
  display_name?: string;
  real_name?: string;
};

export type SlackUser = {
  id: string;
  name: string;
  real_name?: string;
  is_bot?: boolean;
  deleted?: boolean;
  profile?: SlackUserProfile;
};

export type SlackReaction = {
  name: string;
  count: number;
  users: string[];
};

export type SlackMessage = {
  type: string;
  user?: string;
  text?: string;
  ts: string;
  thread_ts?: string;
  reply_count?: number;
  reply_users_count?: number;
  latest_reply?: string;
  edited?: { user: string; ts: string };
  reactions?: SlackReaction[];
  attachments?: unknown[];
  blocks?: unknown[];
  bot_id?: string;
  subtype?: string;
};

export type SlackTeam = {
  id: string;
  name: string;
};

export type SlackEnterprise = {
  id: string;
  name: string;
};

export type SlackAuthedUser = {
  id: string;
  scope?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
};

export type SlackOAuthAccessResponse = {
  ok: boolean;
  app_id?: string;
  access_token?: string;
  token_type?: string;
  scope?: string;
  bot_user_id?: string;
  expires_in?: number;
  refresh_token?: string;
  authed_user?: SlackAuthedUser;
  team?: SlackTeam;
  enterprise?: SlackEnterprise | null;
  is_enterprise_install?: boolean;
  error?: string;
};

export type SlackApiResponse<T> = {
  ok: boolean;
  error?: string;
  response_metadata?: { next_cursor?: string };
} & T;

export type SlackConversationsListResponse = SlackApiResponse<{
  channels: SlackChannel[];
}>;

export type SlackUsersListResponse = SlackApiResponse<{
  members: SlackUser[];
}>;

export type SlackConversationsHistoryResponse = SlackApiResponse<{
  messages: SlackMessage[];
  has_more?: boolean;
}>;

export type SlackConversationsRepliesResponse = SlackApiResponse<{
  messages: SlackMessage[];
  has_more?: boolean;
}>;
