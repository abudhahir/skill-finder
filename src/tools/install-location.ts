import { existsSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

export type InstallBase = '.claude' | '.github' | 'universal'

export interface InstallLocationDecision {
  targetDir?: string
  needsChoice: boolean
  message?: string
}

function isExistingDirectory(path: string): boolean {
  if (!existsSync(path)) return false
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function resolveInstallLocation(
  workspaceRoot: string,
  targetDir?: string,
  installBase?: InstallBase,
  directoryExists: (path: string) => boolean = isExistingDirectory
): InstallLocationDecision {
  if (targetDir && targetDir.trim().length > 0) {
    return { targetDir: resolve(targetDir), needsChoice: false }
  }

  if (installBase) {
    const mapped =
      installBase === 'universal'
        ? workspaceRoot
        : join(workspaceRoot, installBase)
    return { targetDir: mapped, needsChoice: false }
  }

  const hasClaude = directoryExists(join(workspaceRoot, '.claude'))
  const hasGithub = directoryExists(join(workspaceRoot, '.github'))

  if (!hasClaude && !hasGithub) {
    return {
      needsChoice: true,
      message:
        'No .claude or .github directory was found in this workspace. Please choose install_base: ".claude", ".github", or "universal" (recommended for shared project-level docs).',
    }
  }

  return { needsChoice: false }
}
