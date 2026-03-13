# skill-finder

An MCP server that discovers and installs skills, agents, commands, prompts, hooks, and instructions from remote Git repositories (GitHub and GitLab) without cloning them.

## Setup

```json
{
  "mcpServers": {
    "skill-finder": {
      "command": "node",
      "args": ["/path/to/skill-finder/dist/index.js"]
    }
  }
}
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

## Config

Libraries are stored in `~/.skill-finder/libraries.json` (created with `0600` permissions). Tokens are stored in plaintext — treat this file like an SSH key.
