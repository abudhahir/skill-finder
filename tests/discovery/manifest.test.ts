// tests/discovery/manifest.test.ts
import { describe, it, expect } from 'vitest'
import { parseManifest } from '../../src/discovery/manifest.js'

const validManifest = JSON.stringify({
  assets: [
    {
      name: 'tdd',
      description: 'TDD skill',
      tags: ['testing'],
      type: 'skill',
      platform: 'claude-code',
      files: ['skills/tdd/SKILL.md'],
    },
  ],
})

describe('parseManifest', () => {
  it('parses valid JSON manifest', () => {
    const result = parseManifest(validManifest, 'plugin.json', 'myrepo')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('tdd')
    expect(result[0]!.repo).toBe('myrepo')
    expect(result[0]!.path).toBe('skills/tdd/SKILL.md')
    expect(result[0]!.files).toEqual(['skills/tdd/SKILL.md'])
  })

  it('parses YAML manifest', () => {
    const yaml = `assets:\n  - name: my-agent\n    type: agent\n    files: [agents/my-agent.md]`
    const result = parseManifest(yaml, 'registry.yaml', 'myrepo')
    expect(result).toHaveLength(1)
    expect(result[0]!.name).toBe('my-agent')
  })

  it('returns null for malformed manifest', () => {
    const result = parseManifest('not valid json or yaml!!!{{{', 'plugin.json', 'myrepo')
    expect(result).toBeNull()
  })

  it('returns null when required fields missing', () => {
    const bad = JSON.stringify({ assets: [{ description: 'no name or type' }] })
    const result = parseManifest(bad, 'plugin.json', 'myrepo')
    expect(result).toBeNull()
  })

  it('sets defaults for optional fields', () => {
    const minimal = JSON.stringify({ assets: [{ name: 'x', type: 'agent', files: ['agents/x.md'] }] })
    const result = parseManifest(minimal, 'plugin.json', 'myrepo')
    expect(result![0]!.description).toBe('')
    expect(result![0]!.tags).toEqual([])
    expect(result![0]!.platform).toBe('unknown')
  })
})
