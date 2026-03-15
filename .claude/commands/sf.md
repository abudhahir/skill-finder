---
description: Friendly command router for skill-finder MCP tools (search, install, add/list/remove/refresh libraries)
argument-hint: action=<search|install|add-library|list-libraries|remove-library|refresh-index> plus key=value parameters (for example: action=search query="react auth" type=skill limit=10)
allowed-tools:
  - mcp_skill-finder_search
  - mcp_skill-finder_install
  - mcp_skill-finder_install_skill
  - mcp_skill-finder_install_agent
  - mcp_skill-finder_install_command
  - mcp_skill-finder_install_prompt
  - mcp_skill-finder_install_hook
  - mcp_skill-finder_install_instruction
  - mcp_skill-finder_add_library
  - mcp_skill-finder_remove_library
  - mcp_skill-finder_list_libraries
  - mcp_skill-finder_refresh_index
---
Use ONLY skill-finder MCP tools listed in allowed-tools.

Read $ARGUMENTS as command parameters in key=value form. Accept quoted values.

Required behavior:
1. Parse action from `action=...`.
2. Validate required fields for each action.
3. Call the matching skill-finder MCP tool with parsed parameters.
4. If required fields are missing, return a short "Missing parameters" message with an exact example.
5. Return a friendly summary with:
- the tool called
- exact JSON payload used
- key results (top items, files written, or confirmation)

Action map:
- action=search -> mcp_skill-finder_search
  - required: query
  - optional: type, library, platform, limit
  - payload keys: query, type, library, platform, limit

- action=install -> mcp_skill-finder_install
  - required: repo, path
  - optional: platform, target_dir, install_base
  - payload keys: repo, path, platform, target_dir, install_base

- action=install-skill -> mcp_skill-finder_install_skill
  - required: repo, path
  - optional: platform, target_dir, install_base

- action=install-agent -> mcp_skill-finder_install_agent
  - required: repo, path
  - optional: platform, target_dir, install_base

- action=install-command -> mcp_skill-finder_install_command
  - required: repo, path
  - optional: platform, target_dir, install_base

- action=install-prompt -> mcp_skill-finder_install_prompt
  - required: repo, path
  - optional: platform, target_dir, install_base

- action=install-hook -> mcp_skill-finder_install_hook
  - required: repo, path
  - optional: platform, target_dir, install_base

- action=install-instruction -> mcp_skill-finder_install_instruction
  - required: repo, path
  - optional: platform, target_dir, install_base

- action=add-library -> mcp_skill-finder_add_library
  - required: url
  - optional: name, branch, root, token
  - payload keys: url, name, branch, root, token

- action=list-libraries -> mcp_skill-finder_list_libraries
  - no parameters

- action=remove-library -> mcp_skill-finder_remove_library
  - required: name
  - payload keys: name

- action=refresh-index -> mcp_skill-finder_refresh_index
  - optional: library
  - payload keys: library

Examples users can paste:
- /sf action=search query="mcp logging" type=skill platform=copilot limit=8
- /sf action=install repo=awesome-skills path=skills/mcp-debug/SKILL.md platform=copilot install_base=.github
- /sf action=add-library url=https://github.com/org/skills name=org-skills root=skills
- /sf action=remove-library name=org-skills
- /sf action=refresh-index library=org-skills
- /sf action=list-libraries
