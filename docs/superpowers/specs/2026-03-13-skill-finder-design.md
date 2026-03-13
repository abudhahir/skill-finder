# skill-finder MCP Server — Design Spec

Date: 2026-03-13

## Overview

`skill-finder` is a Model Context Protocol (MCP) server that enables local coding agents (Claude Code, GitHub Copilot, etc.) to discover and install reusable assets — skills, agents, commands, prompts, hooks, and instructions — from a configured list of remote Git repositories without cloning them.

It supports multiple Git hosting providers (GitHub, GitLab, extensible to others), searches by name, tag, or description across all registered libraries, and installs assets into the correct platform-specific directories within the current project.

---

## Architecture

```
skill-finder MCP Server
│
├── Config Layer
│   └── ~/.skill-finder/libraries.json  (persisted library registry)
│
├── Provider Layer (abstraction)
│   ├── GitHubProvider  → GitHub REST API + raw.githubusercontent.com
│   └── GitLabProvider  → GitLab API v4 + gitlab.com raw URLs
│
├── Discovery Engine
│   ├── Manifest-first  (plugin.json / index.json / registry.yaml)
│   └── Crawl fallback  (tree API → frontmatter parse from .md files)
│
├── Search Index (in-memory, built per search/refresh)
│   └── Indexed by: name, description, tags, type, platform, repo
│
├── Installer
│   ├── Typed installers per asset type
│   ├── Platform detection from asset metadata
│   ├── Asks user if platform is ambiguous
│   └── Writes files to correct target dirs in CWD
│
└── MCP Tools
    ├── add_library, remove_library, list_libraries, refresh_index
    ├── search
    └── install, install_skill, install_agent, install_command,
        install_prompt, install_hook, install_instruction
```

**Runtime:** Node.js + TypeScript, MCP SDK. Stateless per invocation — reads config on startup, no persistent daemon.

---

## Config Schema

**`~/.skill-finder/libraries.json`**

```json
{
  "libraries": [
    {
      "name": "superpowers",
      "url": "https://github.com/org/repo",
      "provider": "github",
      "token": "ghp_...",
      "root": "plugins/"
    }
  ]
}
```

Fields:
- `name` — human-readable identifier (defaults to repo name)
- `url` — full HTTPS URL to the repository
- `provider` — `"github"` | `"gitlab"` (required)
- `token` — optional PAT for private repos
- `root` — optional subdirectory to narrow the crawl scope

---

## Provider Abstraction

Each provider implements:

```ts
interface Provider {
  listTree(repo: LibraryConfig, path?: string): Promise<TreeEntry[]>
  fetchFile(repo: LibraryConfig, path: string): Promise<string>
  rawUrl(repo: LibraryConfig, path: string): string
}
```

**GitHub:** Uses `api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` for tree listing and `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}` for file content.

**GitLab:** Uses `gitlab.com/api/v4/projects/{encoded-path}/repository/tree?recursive=true` for tree listing and `gitlab.com/{group}/{repo}/-/raw/{branch}/{path}` for file content.

New providers are added by implementing the `Provider` interface and registering against a provider key string.

---

## Discovery Engine

For each registered library, discovery runs in order:

1. **Manifest check** — look for `plugin.json`, `index.json`, or `registry.yaml` at the configured root. If found, parse it to extract asset records directly.
2. **Crawl fallback** — if no manifest, use the provider's tree API to list all files recursively. Filter by known asset paths and extensions.
3. **Frontmatter parse** — for each candidate `.md` file, fetch content and parse YAML frontmatter for `name`, `description`, `tags`, `type`.
4. **Index build** — produce a list of `AssetRecord[]` held in memory for the request lifetime.

**Known asset path conventions crawled:**

| Path pattern | Asset type | Platform |
|---|---|---|
| `skills/**/SKILL.md` | skill | claude-code |
| `agents/*.md` | agent | claude-code |
| `commands/*.md` | command | claude-code |
| `hooks/hooks.json` | hook | claude-code |
| `.github/agents/*.agent.md` | agent | copilot |
| `.github/prompts/*.prompt.md` | prompt | copilot |
| `AGENTS.md`, `.instructions.md` | instruction | copilot |

---

## Asset Record

```ts
interface AssetRecord {
  name: string
  description: string
  tags: string[]
  type: "skill" | "agent" | "command" | "prompt" | "hook" | "instruction"
  platform: "claude-code" | "copilot" | "unknown"
  repo: string        // library name
  path: string        // primary file path within repo
  files: string[]     // all files belonging to this asset (dirs for skills)
}
```

---

## MCP Tools

### Library Management

**`add_library`**
```
params: { url, provider, token?, name?, root? }
```
Adds a repo to `libraries.json`. Validates provider value. Does not crawl on add.

**`remove_library`**
```
params: { name | url }
```
Removes entry from `libraries.json`.

**`list_libraries`**
```
params: none
returns: library configs (tokens redacted)
```

**`refresh_index`**
```
params: { library? }
```
Re-crawls one or all libraries, returns summary counts by asset type.

---

### Search

**`search`**
```
params: {
  query: string,
  type?: "skill"|"agent"|"command"|"prompt"|"hook"|"instruction",
  library?: string,
  platform?: "claude-code"|"copilot"
}
returns: AssetRecord[]  (ranked by relevance: name match > tag match > description match)
```

---

### Install Tools

All install tools share this params shape:

```ts
{
  repo: string          // library name
  path: string          // asset path within repo (from search result)
  platform?: "claude-code" | "copilot"   // asked if ambiguous
  target_dir?: string   // override default CWD-relative target
}
```

**Default install targets (relative to CWD):**

| Tool | Claude Code target | Copilot target |
|---|---|---|
| `install_skill` | `.claude/skills/<name>/` | — |
| `install_agent` | `.claude/agents/` | `.github/agents/` |
| `install_command` | `.claude/commands/` | — |
| `install_prompt` | — | `.github/prompts/` |
| `install_hook` | `.claude/hooks/` | — |
| `install_instruction` | `CLAUDE.md` (append) | `AGENTS.md` (append) |
| `install` | delegates to typed installer | delegates to typed installer |

`install` (general): reads `type` and `platform` from asset metadata and delegates to the appropriate typed tool. If type or platform is unknown, returns a clarifying question to the caller — does not guess.

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Network failure | Surface error with repo + path context. No silent retry. |
| Rate limit (429) | Return error with `retry-after` value if available. |
| Private repo, no token | Clear message: "add token via `add_library`" |
| Ambiguous platform | Return question as MCP response; wait for re-call with `platform` specified |
| Unknown asset type | Same — return question, do not guess |
| Partial crawl failure | Continue other libraries; report failed repo in results |

---

## Testing

- **Unit:** Provider implementations tested against mocked API fixture responses matching GitHub and GitLab response shapes
- **Unit:** Discovery engine tested against fixture repo tree + frontmatter files
- **Unit:** Installer — verify correct CWD-relative target paths per asset type and platform combination
- **Integration:** One public GitHub repo and one public GitLab repo as smoke test fixtures
- **CI:** All network calls mocked — no real API calls in CI
