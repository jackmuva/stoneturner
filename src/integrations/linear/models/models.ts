export type LinearTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string | string[];
  refresh_token?: string;
};

export type LinearUserRef = {
  name?: string | null;
  displayName?: string | null;
};

export type LinearTeamRef = {
  id: string;
  key: string;
  name: string;
};

export type LinearStateRef = {
  name: string;
  type: string;
};

export type LinearProjectRef = {
  id: string;
  name: string;
};

export type LinearComment = {
  body: string;
  createdAt: string;
  user?: LinearUserRef | null;
};

export type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  priority?: number | null;
  estimate?: number | null;
  url: string;
  createdAt: string;
  updatedAt: string;
  state?: LinearStateRef | null;
  team?: LinearTeamRef | null;
  assignee?: LinearUserRef | null;
  labels?: { nodes: { name: string }[] };
  project?: LinearProjectRef | null;
  comments?: { nodes: LinearComment[] };
};

export type LinearProjectNode = {
  id: string;
  name: string;
  description?: string | null;
  state: string;
  progress: number;
  url: string;
  createdAt: string;
  updatedAt: string;
  startDate?: string | null;
  targetDate?: string | null;
  teams?: { nodes: { name: string; key: string }[] };
  lead?: LinearUserRef | null;
};

export type LinearPageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

export type LinearIssuesResponse = {
  data?: {
    issues: {
      nodes: LinearIssueNode[];
      pageInfo: LinearPageInfo;
    };
  };
  errors?: { message: string }[];
};

export type LinearProjectsResponse = {
  data?: {
    projects: {
      nodes: LinearProjectNode[];
      pageInfo: LinearPageInfo;
    };
  };
  errors?: { message: string }[];
};

export type StoredLinearComment = {
  author: string | null;
  body: string;
  createdAt: string;
};
