export type LinearUser = {
  id?: string;
  name?: string | null;
  email?: string | null;
} | null;

export type LinearComment = {
  id: string;
  body?: string | null;
  createdAt?: string;
  updatedAt?: string;
  user?: LinearUser;
};

export type StoredComment = {
  author: string | null;
  body: string | null;
  createdAt: string | null;
};

export type StoredProjectUpdate = {
  body: string | null;
  health: string | null;
  author: string | null;
  createdAt: string | null;
};

export type LinearTeam = {
  id: string;
  key: string;
  name: string;
};

export type LinearLabel = {
  id: string;
  name: string;
};

export type LinearIssueNode = {
  id: string;
  identifier: string;
  title: string;
  description?: string | null;
  url?: string;
  priority?: number;
  estimate?: number | null;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string | null;
  archivedAt?: string | null;
  dueDate?: string | null;
  assignee?: LinearUser;
  creator?: LinearUser;
  state?: { id: string; name: string; type?: string } | null;
  project?: { id: string; name: string } | null;
  cycle?: { id: string; name: string; number?: number } | null;
  labels?: { nodes: LinearLabel[] };
  comments?: {
    nodes: LinearComment[];
    pageInfo: LinearPageInfo;
  };
};

export type LinearProjectNode = {
  id: string;
  name: string;
  description?: string | null;
  url?: string;
  state?: string;
  progress?: number;
  startDate?: string | null;
  targetDate?: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  lead?: LinearUser;
  teams?: { nodes: LinearTeam[] };
  projectUpdates?: {
    nodes: Array<{
      id: string;
      body?: string | null;
      health?: string | null;
      createdAt?: string;
      user?: LinearUser;
    }>;
  };
};

export type LinearDocumentNode = {
  id: string;
  title: string;
  slugId?: string;
  url?: string;
  content?: string | null;
  createdAt?: string;
  updatedAt?: string;
  archivedAt?: string | null;
  creator?: LinearUser;
  updatedBy?: LinearUser;
  project?: { id: string; name: string } | null;
  issue?: { id: string; identifier: string; title: string } | null;
  comments?: {
    nodes: LinearComment[];
    pageInfo?: LinearPageInfo;
  };
};

export type LinearPageInfo = {
  hasNextPage: boolean;
  endCursor?: string | null;
};

export type LinearTokenResponse = {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string | string[];
  refresh_token: string;
};

export type LinearPaginatedCursor = {
  teamId?: string;
  after?: string | null;
};

export const LINEAR_PRIORITY: Record<number, string> = {
  0: "None",
  1: "Urgent",
  2: "High",
  3: "Medium",
  4: "Low",
};
