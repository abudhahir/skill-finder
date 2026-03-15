import { describe, it, expect } from 'vitest'
import { mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { resolveWorkspaceRoot } from '../../src/tools/workspace-root.js'

describe('resolveWorkspaceRoot', () => {
  it('uses explicit target directory when provided', () => {
    const dir = join(tmpdir(), `sf-ws-target-${Date.now()}`)
    mkdirSync(dir, { recursive: true })
    try {
      const result = resolveWorkspaceRoot(dir, '/fallback', {})
      expect(result).toBe(dir)
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })

  it('prefers SKILL_FINDER_WORKSPACE_DIR over fallback cwd', () => {
    const workspace = join(tmpdir(), `sf-ws-env-${Date.now()}`)
    mkdirSync(workspace, { recursive: true })
    try {
      const result = resolveWorkspaceRoot(undefined, '/fallback', {
        SKILL_FINDER_WORKSPACE_DIR: workspace,
      })
      expect(result).toBe(workspace)
    } finally {
      rmSync(workspace, { recursive: true, force: true })
    }
  })

  it('falls back to cwd when no workspace env is available', () => {
    const cwd = join(tmpdir(), `sf-ws-cwd-${Date.now()}`)
    mkdirSync(cwd, { recursive: true })
    try {
      const result = resolveWorkspaceRoot(undefined, cwd, {})
      expect(result).toBe(cwd)
    } finally {
      rmSync(cwd, { recursive: true, force: true })
    }
  })
})
