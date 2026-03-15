import { basename, join } from 'node:path'
import type { Platform } from '../types.js'

function normalized(path: string): string {
  return path.replace(/\\/g, '/').toLowerCase()
}

export function resolveRoutedBase(cwd: string, filePath: string): string | null {
  const p = normalized(filePath)
  const name = basename(filePath).toLowerCase()

  if (p.endsWith('.prompt.md')) return join(cwd, '.github', 'prompts')
  if (p.endsWith('.agent.md')) return join(cwd, '.github', 'agents')

  if (name === 'claude.md' || name === 'agents.md' || p.endsWith('.instructions.md')) {
    return cwd
  }

  if (p.startsWith('commands/') && p.endsWith('.md')) return join(cwd, '.claude', 'commands')
  if (p.startsWith('agents/') && p.endsWith('.md')) return join(cwd, '.claude', 'agents')
  if (p.startsWith('hooks/')) return join(cwd, '.claude', 'hooks')

  return null
}

export function resolveDestinationBase(
  cwd: string,
  targetDir: string | undefined,
  filePath: string,
  fallbackBase: string,
  platform: Platform
): string {
  if (targetDir) return targetDir

  const routed = resolveRoutedBase(cwd, filePath)
  if (routed) return routed

  if (platform === 'copilot' && filePath.toLowerCase().endsWith('.md')) {
    return fallbackBase
  }

  return fallbackBase
}
