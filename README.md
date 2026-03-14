# skill-finder

An MCP server that discovers and installs skills, agents, commands, prompts, hooks, and instructions from remote Git repositories (GitHub and GitLab) without cloning them.

## Setup

### Automatic installation (recommended)

Clone the repo and run the install script — it writes the correct config for every tool automatically:

```bash
git clone https://github.com/abudhahir/skill-finder
cd skill-finder
npm install && npm run build
node scripts/install-mcp.mjs
```

The script configures all three tools at once using `npx skill-finder`:

| Tool | Config file |
|---|---|
| Claude Desktop | macOS: `~/Library/Application Support/Claude/claude_desktop_config.json` |
| | Windows: `%APPDATA%\Claude\claude_desktop_config.json` |
| Claude Code | `~/.claude/settings.json` |
| VS Code (GitHub Copilot) | macOS: `~/Library/Application Support/Code/User/settings.json` |
| | Windows: `%APPDATA%\Code\User\settings.json` |
| | Linux: `~/.config/Code/User/settings.json` |

To use the local build instead of npx (useful during development):

```bash
node scripts/install-mcp.mjs --local
```

Then restart Claude Desktop and/or reload VS Code.

### Manual configuration

**Claude Desktop** — edit `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "skill-finder": {
      "command": "npx",
      "args": ["-y", "skill-finder"]
    }
  }
}
```

**Claude Code** — edit `~/.claude/settings.json` (same structure as above).

**VS Code (GitHub Copilot)** — edit VS Code user `settings.json`:

```json
{
  "mcp": {
    "servers": {
      "skill-finder": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "skill-finder"]
      }
    }
  }
}
```

### Local development mode

If you cloned the repo and want to run it directly without installing:

```bash
npm install
npm run dev
```

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

## Usage

```
add_library url="https://github.com/org/my-skills"
search query="test driven development" type="skill"
install_skill repo="my-skills" path="skills/tdd/SKILL.md"
```

## Testing with MCP Inspector

Anthropic provides [MCP Inspector](https://github.com/modelcontextprotocol/inspector), an interactive UI for testing MCP servers without needing a full Claude setup.

**Installed from npm:**

```bash
npx @modelcontextprotocol/inspector npx skill-finder
```

**From a local clone (no build needed):**

```bash
npx @modelcontextprotocol/inspector npm run dev
```

The inspector opens at `http://localhost:5173` in your browser. From there you can:

- Browse all 12 registered tools in the **Tools** tab
- Call any tool with custom inputs and inspect the response
- Test the full flow: `add_library` → `search` → `install_skill`

**Example flow in the inspector:**

| Step | Tool | Input |
|---|---|---|
| 1 | `add_library` | `url: "https://github.com/anthropics/claude-code"` |
| 2 | `search` | `query: "tdd"`, `type: "skill"` |
| 3 | `install_skill` | `repo: "<name>"`, `path: "<path from search result>"` |

For private repos, pass `token: "ghp_..."` to `add_library`.

## Config

Libraries are stored in `~/.skill-finder/libraries.json` (created with `0600` permissions). Tokens are stored in plaintext — treat this file like an SSH key.
