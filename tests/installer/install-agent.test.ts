// tests/installer/install-agent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installAgent } from '../../src/installer/install-agent.js'
import type { AssetRecord, Provider } from '../../src/types.js'

let testCwd: string

const provider: Provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async () => '# Agent content',
}

beforeEach(() => {
  testCwd = join(tmpdir(), `sf-test-${Date.now()}`)
  mkdirSync(testCwd, { recursive: true })
})
afterEach(() => rmSync(testCwd, { recursive: true, force: true }))

const claudeAgent: AssetRecord = {
  name: 'planner', description: '', tags: [], type: 'agent',
  platform: 'claude-code', repo: 'r', path: 'agents/planner.md', files: ['agents/planner.md'],
}

const copilotAgent: AssetRecord = {
  ...claudeAgent, platform: 'copilot',
  path: '.github/agents/planner.agent.md', files: ['.github/agents/planner.agent.md'],
}

describe('installAgent', () => {
  it('writes to .claude/agents/ for claude-code', async () => {
    await installAgent(claudeAgent, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(existsSync(join(testCwd, '.claude/agents/planner.md'))).toBe(true)
  })

  it('writes to .github/agents/ for copilot', async () => {
    await installAgent(copilotAgent, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(existsSync(join(testCwd, '.github/agents/planner.agent.md'))).toBe(true)
  })

  it('asks for platform when platform is unknown', async () => {
    const unknown = { ...claudeAgent, platform: 'unknown' as const }
    const result = await installAgent(unknown, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(result.message).toMatch(/please specify.*platform/i)
    expect(result.written).toHaveLength(0)
  })
})
