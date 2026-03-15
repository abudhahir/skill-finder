import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installCommand } from '../../src/installer/install-command.js'
import { installHook } from '../../src/installer/install-hook.js'
import type { AssetRecord, Provider } from '../../src/types.js'

let testCwd: string

const provider: Provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async () => '# content',
}

beforeEach(() => {
  testCwd = join(tmpdir(), `sf-routing-${Date.now()}`)
  mkdirSync(testCwd, { recursive: true })
})

afterEach(() => rmSync(testCwd, { recursive: true, force: true }))

describe('file routing by convention', () => {
  it('routes .prompt.md files to .github/prompts', async () => {
    const asset: AssetRecord = {
      name: 'mixed-command',
      description: '',
      tags: [],
      type: 'command',
      platform: 'claude-code',
      repo: 'r',
      path: 'commands/mixed.md',
      files: ['commands/mixed.md', '.github/prompts/review.prompt.md'],
    }

    await installCommand(asset, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)

    expect(existsSync(join(testCwd, '.claude/commands/mixed.md'))).toBe(true)
    expect(existsSync(join(testCwd, '.github/prompts/review.prompt.md'))).toBe(true)
  })

  it('routes .agent.md files to .github/agents', async () => {
    const asset: AssetRecord = {
      name: 'mixed-hook',
      description: '',
      tags: [],
      type: 'hook',
      platform: 'claude-code',
      repo: 'r',
      path: 'hooks/hooks.json',
      files: ['hooks/hooks.json', '.github/agents/reviewer.agent.md'],
    }

    await installHook(asset, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)

    expect(existsSync(join(testCwd, '.claude/hooks/hooks.json'))).toBe(true)
    expect(existsSync(join(testCwd, '.github/agents/reviewer.agent.md'))).toBe(true)
  })
})
