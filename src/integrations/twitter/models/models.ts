export type TwitterPublicMetrics = {
  retweet_count?: number;
  reply_count?: number;
  like_count?: number;
  quote_count?: number;
  bookmark_count?: number;
  impression_count?: number;
};

export type TwitterEntityUrl = {
  url: string;
  expanded_url?: string;
  display_url?: string;
};

export type TwitterEntities = {
  urls?: TwitterEntityUrl[];
  hashtags?: { tag: string }[];
  mentions?: { username: string; id?: string }[];
};

export type TwitterReferencedTweet = {
  type: "retweeted" | "quoted" | "replied_to";
  id: string;
};

export type TwitterUser = {
  id: string;
  name?: string;
  username?: string;
  description?: string;
  created_at?: string;
  public_metrics?: TwitterPublicMetrics;
};

export type TwitterTweet = {
  id: string;
  text: string;
  author_id?: string;
  created_at?: string;
  conversation_id?: string;
  in_reply_to_user_id?: string;
  lang?: string;
  public_metrics?: TwitterPublicMetrics;
  entities?: TwitterEntities;
  referenced_tweets?: TwitterReferencedTweet[];
};

export type TwitterTweetListResponse = {
  data?: TwitterTweet[];
  includes?: { users?: TwitterUser[] };
  meta?: {
    result_count?: number;
    newest_id?: string;
    oldest_id?: string;
    next_token?: string;
  };
  errors?: { detail?: string; title?: string }[];
};

export type TwitterUserResponse = {
  data?: TwitterUser;
  errors?: { detail?: string; title?: string }[];
};
export type TwitterTokenResponse = {
  token_type?: string;
  expires_in?: number;
  access_token: string;
  scope?: string;
  refresh_token?: string;
};
