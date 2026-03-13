// tests/search/search.test.ts
import { describe, it, expect } from 'vitest'
import { searchAssets } from '../../src/search/search.js'
import type { AssetRecord } from '../../src/types.js'

const records: AssetRecord[] = [
  { name: 'tdd', description: 'Test-driven development skill', tags: ['testing', 'tdd'], type: 'skill', platform: 'claude-code', repo: 'r', path: 'a', files: ['a'] },
  { name: 'planner', description: 'Plan features', tags: ['planning'], type: 'agent', platform: 'claude-code', repo: 'r', path: 'b', files: ['b'] },
  { name: 'commit', description: 'Git commit helper', tags: ['git'], type: 'command', platform: 'claude-code', repo: 'r', path: 'c', files: ['c'] },
]

describe('searchAssets', () => {
  it('returns name match first', () => {
    const results = searchAssets(records, { query: 'tdd' })
    expect(results[0]!.name).toBe('tdd')
  })

  it('matches by tag', () => {
    const results = searchAssets(records, { query: 'testing' })
    expect(results.some((r) => r.name === 'tdd')).toBe(true)
  })

  it('matches by description', () => {
    const results = searchAssets(records, { query: 'git commit' })
    expect(results.some((r) => r.name === 'commit')).toBe(true)
  })

  it('filters by type', () => {
    const results = searchAssets(records, { query: '', type: 'agent' })
    expect(results.every((r) => r.type === 'agent')).toBe(true)
  })

  it('filters by platform', () => {
    const results = searchAssets(records, { query: '', platform: 'claude-code' })
    expect(results.length).toBeGreaterThan(0)
    expect(results.every((r) => r.platform === 'claude-code')).toBe(true)
  })

  it('respects limit', () => {
    const results = searchAssets(records, { query: '', limit: 2 })
    expect(results).toHaveLength(2)
  })

  it('filters by library name', () => {
    const mixed = [
      ...records,
      { ...records[0]!, repo: 'other-lib', name: 'tdd-other' },
    ]
    const results = searchAssets(mixed, { query: '', library: 'r' })
    expect(results.every((r) => r.repo === 'r')).toBe(true)
  })

  it('returns empty array when nothing matches', () => {
    const results = searchAssets(records, { query: 'zzznomatch' })
    expect(results).toHaveLength(0)
  })
})
