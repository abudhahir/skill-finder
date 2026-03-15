import { existsSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const WORKSPACE_ENV_KEYS = [
  'SKILL_FINDER_WORKSPACE_DIR',
  'MCP_WORKSPACE_ROOT',
  'VSCODE_WORKSPACE_FOLDER',
  'VSCODE_WORKSPACE_ROOT',
  'GITHUB_WORKSPACE',
  'INIT_CWD',
  'PWD',
] as const

function isExistingDirectory(path: string): boolean {
  if (!existsSync(path)) return false
  try {
    return statSync(path).isDirectory()
  } catch {
    return false
  }
}

export function resolveWorkspaceRoot(targetDir?: string, cwd = process.cwd(), env = process.env): string {
  if (targetDir && targetDir.trim().length > 0) {
    return resolve(targetDir)
  }

  for (const key of WORKSPACE_ENV_KEYS) {
    const value = env[key]
    if (!value || value.trim().length === 0) continue
    const candidate = resolve(value)
    if (isExistingDirectory(candidate)) return candidate
  }

  return resolve(cwd)
}
