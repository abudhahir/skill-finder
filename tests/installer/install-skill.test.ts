// tests/installer/install-skill.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installSkill } from '../../src/installer/install-skill.js'
import type { AssetRecord, Provider } from '../../src/types.js'

let testCwd: string

const provider: Provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async (_, path) => path.endsWith('SKILL.md') ? '# Skill content' : '# Other',
}

const asset: AssetRecord = {
  name: 'tdd',
  description: 'TDD skill',
  tags: ['testing'],
  type: 'skill',
  platform: 'claude-code',
  repo: 'myrepo',
  path: 'skills/tdd/SKILL.md',
  files: ['skills/tdd/SKILL.md', 'skills/tdd/examples.md'],
}

const repoConfig = { name: 'myrepo', url: 'https://github.com/a/b' }

beforeEach(() => {
  testCwd = join(tmpdir(), `skill-finder-test-${Date.now()}`)
  mkdirSync(testCwd, { recursive: true })
})

afterEach(() => rmSync(testCwd, { recursive: true, force: true }))

describe('installSkill', () => {
  it('writes all skill files to .claude/skills/<dir-name>/', async () => {
    const result = await installSkill(asset, repoConfig, provider, testCwd)
    expect(result.written).toHaveLength(2)
    expect(existsSync(join(testCwd, '.claude/skills/tdd/SKILL.md'))).toBe(true)
    expect(existsSync(join(testCwd, '.claude/skills/tdd/examples.md'))).toBe(true)
  })

  it('overwrites existing files and returns update message', async () => {
    await installSkill(asset, repoConfig, provider, testCwd)
    const result = await installSkill(asset, repoConfig, provider, testCwd)
    expect(result.message).toMatch(/updated/i)
  })

  it('respects custom targetDir', async () => {
    const custom = join(testCwd, 'my-skills')
    const result = await installSkill(asset, repoConfig, provider, testCwd, custom)
    expect(existsSync(join(custom, 'tdd/SKILL.md'))).toBe(true)
  })
})
