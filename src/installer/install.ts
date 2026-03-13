// src/installer/install.ts
import type { AssetRecord, InstallParams, InstallResult, LibraryConfig, Provider } from '../types.js'
import { findAsset, getOrPopulate } from '../discovery/session-cache.js'
import { installSkill } from './install-skill.js'
import { installAgent } from './install-agent.js'
import { installCommand } from './install-command.js'
import { installPrompt } from './install-prompt.js'
import { installHook } from './install-hook.js'
import { installInstruction } from './install-instruction.js'

export async function install(
  params: InstallParams,
  libraries: LibraryConfig[],
  provider: Provider,
  cwd: string
): Promise<InstallResult> {
  let asset = findAsset(params.repo, params.path)

  if (!asset) {
    await getOrPopulate(libraries)
    asset = findAsset(params.repo, params.path)
  }

  if (!asset) {
    return { written: [], message: `Asset not found: repo="${params.repo}" path="${params.path}"` }
  }

  const resolved: AssetRecord = {
    ...asset,
    platform: params.platform ?? asset.platform,
  }

  const repo = libraries.find((l) => l.name === params.repo)
  if (!repo) return { written: [], message: `Library "${params.repo}" not registered` }

  switch (resolved.type) {
    case 'skill': return installSkill(resolved, repo, provider, cwd, params.targetDir)
    case 'agent': return installAgent(resolved, repo, provider, cwd, params.targetDir)
    case 'command': return installCommand(resolved, repo, provider, cwd, params.targetDir)
    case 'prompt': return installPrompt(resolved, repo, provider, cwd, params.targetDir)
    case 'hook': return installHook(resolved, repo, provider, cwd, params.targetDir)
    case 'instruction': return installInstruction(resolved, repo, provider, cwd, params.targetDir)
    default:
      return { written: [], message: `Unknown asset type "${resolved.type}". Please specify one of: skill, agent, command, prompt, hook, instruction` }
  }
}
