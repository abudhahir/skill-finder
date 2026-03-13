// src/tools/install-tools.ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from '../config/config.js'
import { getProvider } from '../providers/registry.js'
import { install } from '../installer/install.js'
import { installSkill } from '../installer/install-skill.js'
import { installAgent } from '../installer/install-agent.js'
import { installCommand } from '../installer/install-command.js'
import { installPrompt } from '../installer/install-prompt.js'
import { installHook } from '../installer/install-hook.js'
import { installInstruction } from '../installer/install-instruction.js'
import { findAsset, getOrPopulate } from '../discovery/session-cache.js'
import type { AssetRecord, Platform } from '../types.js'

const installParamsSchema = z.object({
  repo: z.string().describe('Library name (asset.repo from search result)'),
  path: z.string().describe('Asset path within repo (asset.path from search result)'),
  platform: z.enum(['claude-code', 'copilot']).optional(),
  target_dir: z.string().optional().describe('Override default install directory'),
})

async function resolveAsset(repo: string, path: string, libraries: Awaited<ReturnType<typeof loadConfig>>['libraries']): Promise<AssetRecord | null> {
  let asset = findAsset(repo, path)
  if (!asset) {
    await getOrPopulate(libraries)
    asset = findAsset(repo, path)
  }
  return asset ?? null
}

function resultToContent(result: { written: string[]; message: string }) {
  return { content: [{ type: 'text' as const, text: result.message }] }
}

export function registerInstallTools(server: McpServer): void {
  server.registerTool(
    'install',
    {
      description: 'Install any asset by repo and path — detects type automatically',
      inputSchema: installParamsSchema,
    },
    async ({ repo, path, platform, target_dir }) => {
      const config = await loadConfig()
      const libConfig = config.libraries.find((l) => l.name === repo)
      if (!libConfig) {
        return { content: [{ type: 'text' as const, text: `Library "${repo}" not registered. Use add_library to add it.` }], isError: true }
      }
      const provider = getProvider(libConfig.url)
      const result = await install(
        { repo, path, platform: platform as Platform | undefined, targetDir: target_dir },
        config.libraries, provider, process.cwd()
      )
      const isError = result.written.length === 0 && result.message.toLowerCase().includes('not found')
      return { content: [{ type: 'text' as const, text: result.message }], ...(isError ? { isError: true } : {}) }
    }
  )

  const typedInstaller = (
    toolName: string,
    description: string,
    handler: (asset: AssetRecord, repo: Awaited<ReturnType<typeof loadConfig>>['libraries'][0], provider: ReturnType<typeof getProvider>, cwd: string, targetDir?: string) => Promise<{ written: string[]; message: string }>
  ) => {
    server.registerTool(toolName, { description, inputSchema: installParamsSchema }, async ({ repo, path, platform, target_dir }) => {
      const config = await loadConfig()
      const libConfig = config.libraries.find((l) => l.name === repo)
      if (!libConfig) return { content: [{ type: 'text' as const, text: `Library "${repo}" not registered` }], isError: true }

      const asset = await resolveAsset(repo, path, config.libraries)
      if (!asset) return { content: [{ type: 'text' as const, text: `Asset not found: repo="${repo}" path="${path}"` }], isError: true }

      const resolved = { ...asset, platform: (platform as Platform | undefined) ?? asset.platform }
      const provider = getProvider(libConfig.url)
      const result = await handler(resolved, libConfig, provider, process.cwd(), target_dir)
      return resultToContent(result)
    })
  }

  typedInstaller('install_skill', 'Install a skill to .claude/skills/', installSkill)
  typedInstaller('install_agent', 'Install an agent to .claude/agents/ or .github/agents/', installAgent)
  typedInstaller('install_command', 'Install a slash command to .claude/commands/', installCommand)
  typedInstaller('install_prompt', 'Install a prompt file to .github/prompts/', installPrompt)
  typedInstaller('install_hook', 'Install a hook to .claude/hooks/', installHook)
  typedInstaller('install_instruction', 'Append an instruction to CLAUDE.md or AGENTS.md', installInstruction)
}
