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
│   └── ~/.skill-finder/libraries.json  (persisted library registry, chmod 0600)
│
├── Provider Layer (abstraction)
│   ├── GitHubProvider  → GitHub REST API + raw.githubusercontent.com
│   └── GitLabProvider  → GitLab API v4 + gitlab.com raw URLs
│
├── Discovery Engine
│   ├── Manifest-first  (plugin.json / index.json / registry.yaml)
│   └── Crawl fallback  (tree API → frontmatter parse from .md files)
│
├── Search Index (session cache, populated on first search or refresh_index)
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

**Runtime:** Node.js + TypeScript, MCP SDK. Reads config on startup. The search index is a session-level in-memory cache: populated on the first `search` call (or via `refresh_index`) and reused for subsequent calls within the same session.

---

## Config Schema

**`~/.skill-finder/libraries.json`** — created with `0600` permissions. Tokens are stored in plaintext; users should treat this file like an SSH key.

```json
{
  "libraries": [
    {
      "name": "superpowers",
      "url": "https://github.com/org/repo",
      "branch": "main",
      "token": "ghp_...",
      "root": "plugins/"
    }
  ]
}
```

Fields:
- `name` — human-readable identifier (defaults to repo slug from URL)
- `url` — full HTTPS URL to the repository (provider is auto-detected from hostname)
- `branch` — optional; defaults to the repository's default branch (resolved via API on first use)
- `token` — optional PAT for private repos
- `root` — optional subdirectory to narrow the crawl scope. Trailing slashes are normalized on read (e.g., `"plugins/"` → `"plugins"`). When set, the manifest is sought at `<root>/plugin.json` (e.g., `root: "plugins"` → checks `plugins/plugin.json`). All crawl paths are also relative to `root`. When absent, the repo root is used.

**Provider auto-detection:** The `provider` field is not required. The provider is inferred from the URL hostname:
- `github.com` → `GitHubProvider`
- `gitlab.com` or any `*.gitlab.com` hostname → `GitLabProvider`

Adding explicit provider override support is out of scope for v1.

---

## Provider Abstraction

Each provider implements:

```ts
interface Provider {
  resolveDefaultBranch(repo: LibraryConfig): Promise<string>
  listTree(repo: LibraryConfig): Promise<TreeEntry[]>
  fetchFile(repo: LibraryConfig, path: string): Promise<string>
}

interface TreeEntry {
  path: string
  type: "blob" | "tree"
}
```

**Branch resolution:** If `branch` is not set in the config, the provider calls the API to resolve the repository's default branch and caches the result in memory for the session.

**GitHub:**
- Tree: `GET api.github.com/repos/{owner}/{repo}/git/trees/{branch}?recursive=1` — returns full tree in one response
- File: `raw.githubusercontent.com/{owner}/{repo}/{branch}/{path}`
- Default branch: `GET api.github.com/repos/{owner}/{repo}` → `.default_branch`

**GitLab:**
- Tree: `GET gitlab.com/api/v4/projects/{encoded-path}/repository/tree?recursive=true&per_page=100` — paginated; iterate until `X-Next-Page` header is empty
- File: `GET gitlab.com/api/v4/projects/{encoded-path}/repository/files/{encoded-path}/raw?ref={branch}`
- Default branch: `GET gitlab.com/api/v4/projects/{encoded-path}` → `.default_branch`

New providers are added by implementing the `Provider` interface and registering against the URL hostname.

---

## Discovery Engine

For each registered library, discovery runs in order:

1. **Manifest check** — look for `plugin.json`, `index.json`, or `registry.yaml` at the configured root. If found, parse it as an asset manifest (see Manifest Format below).
2. **Crawl fallback** — if no manifest, use the provider's `listTree` to list all files. Filter by known asset paths and extensions.
3. **Frontmatter parse** — for each candidate `.md` file, fetch content and parse YAML frontmatter for `name`, `description`, `tags`, `type`.
4. **Skill directory expansion** — for skill assets (identified by `SKILL.md`), walk the parent directory entries from the tree to collect all sibling files. Populate `files[]` with the explicit list of file paths.
5. **Hook asset handling** — for `hooks/hooks.json`, fetch and parse as JSON. Each entry in the hooks config is treated as a separate hook asset with its own name and description.
6. **Index build** — produce `AssetRecord[]` stored in the session cache.

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

## Manifest Format

When a manifest file is present, it must contain an array of asset descriptors. Supported formats:

**`plugin.json`** (Claude Code plugin convention):
```json
{
  "assets": [
    {
      "name": "tdd",
      "description": "Test-driven development skill",
      "tags": ["testing", "tdd"],
      "type": "skill",
      "platform": "claude-code",
      "files": ["skills/tdd/SKILL.md", "skills/tdd/examples.md"]
    }
  ]
}
```

**`index.json`** — same structure as `plugin.json`.

**`registry.yaml`** — same structure in YAML form.

Required fields per entry: `name`, `type`, `files[]`. Optional: `description`, `tags`, `platform`.

If the manifest is malformed or missing required fields, fall back to crawl discovery for that library.

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
  path: string        // primary file path within repo (e.g., skills/tdd/SKILL.md)
  files: string[]     // explicit list of all file paths belonging to this asset
}
```

`files[]` always contains explicit file paths (never directory references). For skills, it contains every file in the skill's directory. For single-file assets, it contains one entry matching `path`.

---

## MCP Tools

### Library Management

**`add_library`**
```
params: { url, branch?, token?, name?, root? }
```
Adds a repo to `libraries.json`. Provider is auto-detected from URL. Creates the config file with `0600` permissions if it does not exist.

**`remove_library`**
```
params: { name: string }
```
Removes the entry with the matching `name` from `libraries.json`. Returns an error if no entry with that name exists.

**`list_libraries`**
```
params: none
returns: library configs with token field replaced by "***" if set
```

**`refresh_index`**
```
params: { library?: string }
```
Clears and rebuilds the session cache for one or all libraries. Returns a summary: `{ library, assetCount, byType: { skill: N, agent: N, ... } }` per library. Useful when a repo has been updated and the caller wants fresh results within the same session.

---

### Search

**`search`**
```
params: {
  query: string,
  type?: "skill"|"agent"|"command"|"prompt"|"hook"|"instruction",
  library?: string,
  platform?: "claude-code"|"copilot",
  limit?: number   // default: 20
}
returns: AssetRecord[]  (ranked: name match > tag match > description match)
```

On first call within a session, populates the index cache by crawling all registered libraries. Subsequent calls use the cached index. Pass the returned `asset.repo` and `asset.path` directly to any install tool.

---

### Install Tools

All install tools share this params shape:

```ts
{
  repo: string          // asset.repo from search result
  path: string          // asset.path from search result
  platform?: "claude-code" | "copilot"   // asked if ambiguous
  target_dir?: string   // override default CWD-relative target (optional)
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
| `install_instruction` | append to `CLAUDE.md` | append to `AGENTS.md` |
| `install` | delegates to typed installer | delegates to typed installer |

**`install_instruction` behavior:**
- If the target file does not exist, create it with the asset content.
- If it exists, perform a heading match: scan for any H1–H3 line (`#`, `##`, or `###`), strip the leading `#` characters and surrounding whitespace to extract the heading text, then compare it against `AssetRecord.name` using an exact, case-insensitive, whitespace-trimmed match. If a match is found, skip and return a message indicating it is already installed. If not found, append the content at the end of the file under a `##` heading.
- Never silently overwrite existing content.

**`install_skill` target directory:** The `<name>` in `.claude/skills/<name>/` is derived from the source directory name (the path component immediately containing `SKILL.md`), not `AssetRecord.name`. For example, a skill at `skills/tdd/SKILL.md` installs to `.claude/skills/tdd/`.

**`install` (general):** Looks up the `AssetRecord` in the session cache by `(repo, path)`. If the cache is empty, populates it first (same lazy-load as `search`). If the asset is not found after population, returns a not-found error. Once found, reads `type` and `platform` from the record and delegates to the appropriate typed tool. If `type` is unknown, returns a clarifying question — does not guess.

**Update behavior:** If the target file(s) already exist, overwrite them and return a message indicating the asset was updated. Applies to all typed installers except `install_instruction` (which uses the deduplication logic above).

---

## Error Handling

| Scenario | Behavior |
|---|---|
| Network failure | Surface error with repo + path context. No silent retry. |
| Rate limit (429) | Return error with `retry-after` value if available. |
| Private repo, no token | Clear message: "add token via `add_library`" |
| GitLab pagination incomplete | Iterate all pages before returning; surface error if pagination fails mid-way |
| Ambiguous platform | Return question as MCP response; wait for re-call with `platform` specified |
| Unknown asset type | Same — return question, do not guess |
| Malformed manifest | Fall back to crawl discovery, log warning in response |
| Partial crawl failure | Continue other libraries; report failed repo in results |

---

## Testing

- **Unit:** Provider implementations tested against mocked API fixture responses matching GitHub and GitLab API shapes, including paginated GitLab tree responses
- **Unit:** Discovery engine tested against fixture repo tree + frontmatter files, including skill directory expansion and hook JSON parsing
- **Unit:** Installer — verify correct CWD-relative target paths per asset type and platform; verify `install_instruction` deduplication logic
- **Integration:** One public GitHub repo and one public GitLab repo as smoke test fixtures
- **CI:** All network calls mocked — no real API calls in CI
