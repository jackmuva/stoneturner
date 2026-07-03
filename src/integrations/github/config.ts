import type { IntegrationConfig } from "@/core/models/models";

const redirectUri = encodeURIComponent(`${process.env.BUN_PUBLIC_BACKEND_BASE_URL}/api/oauth/github`);

export const githubConfig: IntegrationConfig = {
  integration: "github",
  icon: "/assets/github.svg",
  integrationType: "OAUTH",
  description: "Connect GitHub via OAuth to sync issues, pull requests, docs, discussions, and source code into searchable markdown. After authorizing, provide the repositories you want to sync.",
  oauthAuthorizationUrl: `https://github.com/login/oauth/authorize?client_id=${process.env.BUN_PUBLIC_GITHUB_CLIENT_ID}&redirect_uri=${redirectUri}&scope=repo,read:org,read:discussion,read:user&response_type=code`,
  optionInputs: [
    { key: "repos", label: "Repositories (comma-separated, e.g. owner/repo1, owner/repo2)" },
    { key: "branch", label: "Branch (optional, defaults to each repo's default branch)", optional: true },
  ],
};
