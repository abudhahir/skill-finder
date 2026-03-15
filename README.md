# skill-finder

An MCP server that discovers and installs skills, agents, commands, prompts, hooks, and instructions from remote Git repositories (GitHub and GitLab) without cloning them.

## Prerequisites

- Node.js 18 or later (`node --version` to check)

## Build

```bash
git clone https://github.com/abudhahir/skill-finder
cd skill-finder
npm install
npm run build
```

This produces `dist/index.js`, which is the server entry point.

## Setup

All tools run the server via `node /absolute/path/to/dist/index.js`. Replace the path with wherever you cloned the repo.

---

### VS Code (GitHub Copilot)

Open **Settings (JSON)** (`Ctrl+Shift+P` → "Open User Settings JSON") and add:

```json
{
  "mcp": {
    "servers": {
      "skill-finder": {
        "type": "stdio",
        "command": "node",
        "args": ["C:/Projects/working/mcpservers/skill-finder/dist/index.js"]
      }
    }
  }
}
```

Reload VS Code after saving. To verify it loaded, open GitHub Copilot Chat, switch to **Agent** mode, and check that the skill-finder tools appear.

> **Windows paths:** Use forward slashes (`C:/path/to/...`) or escaped backslashes (`C:\\path\\to\\...`). Both work in JSON.

---

### Claude Desktop

Edit the config file:

- **Windows:** `%APPDATA%\Claude\claude_desktop_config.json`
- **macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "skill-finder": {
      "command": "node",
      "args": ["/absolute/path/to/skill-finder/dist/index.js"]
    }
  }
}
```

Restart Claude Desktop after saving.

---

### Claude Code

Edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "skill-finder": {
      "command": "node",
      "args": ["/absolute/path/to/skill-finder/dist/index.js"]
    }
  }
}
```

---

### Development (no build required)

To run the server directly from TypeScript source:

```bash
npm run dev
```

To use the dev server in a tool config, replace `node` + `dist/index.js` with:

```json
{
  "command": "npx",
  "args": ["tsx", "/absolute/path/to/skill-finder/src/index.ts"]
}
```

---

## Testing with MCP Inspector

Verify the server works before configuring any tool:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

The inspector opens at `http://localhost:5173`. From the **Tools** tab you can call any tool and inspect the response.

Example flow:

| Step | Tool | Input |
|---|---|---|
| 1 | `add_library` | `url: "https://github.com/anthropics/claude-code"` |
| 2 | `search` | `query: "tdd"`, `type: "skill"` |
| 3 | `install_skill` | `repo: "<name>"`, `path: "<path from search result>"` |

---

## Tools

| Tool | Description |
|---|---|
| `add_library` | Register a GitHub/GitLab repo as a source |
| `remove_library` | Remove a registered library |
| `list_libraries` | List all registered libraries |
| `refresh_index` | Re-crawl libraries to pick up new assets |
| `search` | Search across all libraries by name, tag, or description |
| `install` | Install any asset (auto-detects type) |
| `install_skill` | Install a skill to `.claude/skills/` |
| `install_agent` | Install an agent to `.claude/agents/` or `.github/agents/` |
| `install_command` | Install a command to `.claude/commands/` |
| `install_prompt` | Install a prompt to `.github/prompts/` |
| `install_hook` | Install a hook to `.claude/hooks/` |
| `install_instruction` | Append an instruction to `CLAUDE.md` or `AGENTS.md` |

For private repos, pass `token: "ghp_..."` to `add_library`.

### Install location selection

Install tools support two location controls:

- `target_dir` (highest priority): explicit absolute/relative destination root
- `install_base`: one of `.claude`, `.github`, `universal`

Behavior when no location is provided:

1. If workspace contains `.claude` or `.github`, install proceeds using defaults and per-file routing.
2. If workspace contains neither `.claude` nor `.github`, tool returns a clarification asking for `install_base`.

`install_base` mapping:

- `.claude` -> `<workspace>/.claude`
- `.github` -> `<workspace>/.github`
- `universal` -> `<workspace>`

## Friendly Slash Command And Prompt

This repo now includes a parameter-driven slash command and a reusable prompt that route only to `skill-finder` MCP tools:

- `.claude/commands/sf.md` -> use as `/sf ...`
- `.github/prompts/skill-finder-friendly.prompt.md`

### `/sf` command format

Use key=value pairs (quoted values allowed):

```text
/sf action=<search|install|add-library|list-libraries|remove-library|refresh-index> ...params
```

Examples:

```text
/sf action=search query="mcp logging" type=skill platform=copilot limit=8
/sf action=install repo=awesome-skills path=skills/mcp-debug/SKILL.md platform=copilot install_base=.github
/sf action=add-library url=https://github.com/org/skills name=org-skills root=skills
/sf action=remove-library name=org-skills
/sf action=refresh-index library=org-skills
/sf action=list-libraries
```

### Supported parameters

- `search`: `query` (required), `type`, `library`, `platform`, `limit`
- `install`: `repo` (required), `path` (required), `platform`, `target_dir`, `install_base`
- `add-library`: `url` (required), `name`, `branch`, `root`, `token`
- `remove-library`: `name` (required)
- `list-libraries`: no parameters
- `refresh-index`: `library` (optional)

Typed installs are also supported via `action=install-skill`, `install-agent`, `install-command`, `install-prompt`, `install-hook`, and `install-instruction` with `repo`, `path`, plus optional `platform`, `target_dir`, `install_base`.

## Config storage

Libraries and tokens are stored in `~/.skill-finder/libraries.json` (created with `0600` permissions). Treat this file like an SSH key.
