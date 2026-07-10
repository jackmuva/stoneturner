export type HubspotTokenResponse = {
  token_type: string;
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  hub_id?: number;
  scopes?: string[];
};

export type HubspotCrmObject = {
  id: string;
  properties: Record<string, string | null>;
  createdAt: string;
  updatedAt: string;
  archived?: boolean;
};

export type HubspotListResponse = {
  results: HubspotCrmObject[];
  paging?: {
    next?: {
      after: string;
      link?: string;
    };
  };
};

export type HubspotSearchResponse = HubspotListResponse & {
  total?: number;
};

export type HubspotSyncCursor = {
  after?: string;
  watermarkMs?: string;
};
