// tests/installer/install-instruction.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installInstruction } from '../../src/installer/install-instruction.js'
import type { AssetRecord, Provider } from '../../src/types.js'

let testCwd: string

const provider: Provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async () => '## my-rule\n\nDo the thing.',
}

const asset: AssetRecord = {
  name: 'my-rule', description: '', tags: [], type: 'instruction',
  platform: 'claude-code', repo: 'r', path: 'CLAUDE.md', files: ['CLAUDE.md'],
}

beforeEach(() => {
  testCwd = join(tmpdir(), `sf-test-${Date.now()}`)
  mkdirSync(testCwd, { recursive: true })
})
afterEach(() => rmSync(testCwd, { recursive: true, force: true }))

describe('installInstruction', () => {
  it('creates target file when it does not exist', async () => {
    const result = await installInstruction(asset, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    const content = readFileSync(join(testCwd, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('Do the thing.')
    expect(result.written).toHaveLength(1)
  })

  it('appends under new heading when name not found, stripping content leading heading', async () => {
    writeFileSync(join(testCwd, 'CLAUDE.md'), '# Existing\nSome content.', 'utf-8')
    await installInstruction(asset, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    const content = readFileSync(join(testCwd, 'CLAUDE.md'), 'utf-8')
    expect(content).toContain('Existing')
    expect(content).toContain('Do the thing.')
    // Should have exactly one occurrence of the section heading
    expect(content.match(/##\s+my-rule/g)).toHaveLength(1)
  })

  it('skips when heading already present (case-insensitive)', async () => {
    writeFileSync(join(testCwd, 'CLAUDE.md'), '## MY-RULE\nAlready here.', 'utf-8')
    const result = await installInstruction(asset, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(result.message).toMatch(/already installed/i)
    const content = readFileSync(join(testCwd, 'CLAUDE.md'), 'utf-8')
    expect(content).not.toContain('Do the thing.')
  })

  it('writes to AGENTS.md for copilot platform', async () => {
    const copilot = { ...asset, platform: 'copilot' as const }
    await installInstruction(copilot, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    const content = readFileSync(join(testCwd, 'AGENTS.md'), 'utf-8')
    expect(content).toContain('Do the thing.')
  })
})
