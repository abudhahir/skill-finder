// tests/discovery/crawl.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { discoverLibrary } from '../../src/discovery/crawl.js'
import type { LibraryConfig, Provider, TreeEntry } from '../../src/types.js'

function makeProvider(tree: TreeEntry[], files: Record<string, string>): Provider {
  return {
    resolveDefaultBranch: async () => 'main',
    listTree: async () => tree,
    fetchFile: async (_, path) => files[path] ?? '',
  }
}

const repoConfig: LibraryConfig = { name: 'myrepo', url: 'https://github.com/a/b' }

describe('discoverLibrary — manifest path', () => {
  it('uses manifest when plugin.json found', async () => {
    const manifest = JSON.stringify({
      assets: [{ name: 'tdd', type: 'skill', files: ['skills/tdd/SKILL.md'] }],
    })
    const tree: TreeEntry[] = [{ path: 'plugin.json', type: 'blob' }]
    const provider = makeProvider(tree, { 'plugin.json': manifest })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records).toHaveLength(1)
    expect(records[0]!.name).toBe('tdd')
  })
})

describe('discoverLibrary — crawl path', () => {
  it('discovers skills by SKILL.md pattern', async () => {
    const tree: TreeEntry[] = [
      { path: 'skills/tdd/SKILL.md', type: 'blob' },
      { path: 'skills/tdd/examples.md', type: 'blob' },
    ]
    const skillMd = `---\nname: tdd\ndescription: TDD skill\ntags: [testing]\n---`
    const provider = makeProvider(tree, { 'skills/tdd/SKILL.md': skillMd })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records).toHaveLength(1)
    expect(records[0]!.type).toBe('skill')
    expect(records[0]!.platform).toBe('claude-code')
    // Both files collected
    expect(records[0]!.files).toContain('skills/tdd/examples.md')
  })

  it('discovers agents by path pattern', async () => {
    const tree: TreeEntry[] = [{ path: 'agents/planner.md', type: 'blob' }]
    const agentMd = `---\nname: planner\ndescription: Plans stuff\n---`
    const provider = makeProvider(tree, { 'agents/planner.md': agentMd })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records).toHaveLength(1)
    expect(records[0]!.type).toBe('agent')
    expect(records[0]!.platform).toBe('claude-code')
  })

  it('discovers copilot agents by .agent.md extension', async () => {
    const tree: TreeEntry[] = [{ path: '.github/agents/planner.agent.md', type: 'blob' }]
    const provider = makeProvider(tree, { '.github/agents/planner.agent.md': '---\nname: planner\n---' })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records[0]!.platform).toBe('copilot')
    expect(records[0]!.type).toBe('agent')
  })

  it('strips compound extension from copilot agent name', async () => {
    const tree: TreeEntry[] = [{ path: '.github/agents/planner.agent.md', type: 'blob' }]
    const provider = makeProvider(tree, { '.github/agents/planner.agent.md': '# no frontmatter' })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records[0]!.name).toBe('planner')
  })

  it('splits hooks/hooks.json into one asset per hook entry', async () => {
    const hooksJson = JSON.stringify({
      hooks: [
        { name: 'pre-commit', description: 'Run before commit', event: 'PreToolUse', command: 'npm test' },
        { name: 'post-commit', description: 'Run after commit', event: 'PostToolUse', command: 'npm lint' },
      ]
    })
    const tree: TreeEntry[] = [{ path: 'hooks/hooks.json', type: 'blob' }]
    const provider = makeProvider(tree, { 'hooks/hooks.json': hooksJson })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records).toHaveLength(2)
    expect(records[0]!.name).toBe('pre-commit')
    expect(records[1]!.name).toBe('post-commit')
    expect(records[0]!.type).toBe('hook')
  })

  it('falls back to filename when frontmatter name missing', async () => {
    const tree: TreeEntry[] = [{ path: 'commands/commit.md', type: 'blob' }]
    const provider = makeProvider(tree, { 'commands/commit.md': '# no frontmatter' })
    const records = await discoverLibrary(repoConfig, provider)
    expect(records[0]!.name).toBe('commit')
  })
})
