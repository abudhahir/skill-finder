// tests/installer/install.test.ts
import { describe, it, expect, vi } from 'vitest'
import { install } from '../../src/installer/install.js'

// Mock session cache
vi.mock('../../src/discovery/session-cache.js', () => ({
  findAsset: vi.fn(),
  getOrPopulate: vi.fn(),
}))

import { findAsset, getOrPopulate } from '../../src/discovery/session-cache.js'

const mockFindAsset = vi.mocked(findAsset)
const mockGetOrPopulate = vi.mocked(getOrPopulate)

const provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async () => '# content',
}

describe('install (general)', () => {
  it('returns not-found error when asset absent after cache population', async () => {
    mockFindAsset.mockReturnValue(undefined)
    mockGetOrPopulate.mockResolvedValue([])
    const result = await install(
      { repo: 'r', path: 'nonexistent.md' },
      [],
      provider as any,
      '/tmp/cwd'
    )
    expect(result.message).toMatch(/not found/i)
  })

  it('returns clarifying question when type is unrecognized', async () => {
    mockFindAsset.mockReturnValue({
      name: 'x', description: '', tags: [], type: 'unknown-type' as any,
      platform: 'claude-code' as any, repo: 'r', path: 'p', files: ['p'],
    })
    const result = await install(
      { repo: 'r', path: 'p', platform: undefined },
      [{ name: 'r', url: 'https://github.com/a/b' }],
      provider as any,
      '/tmp/cwd'
    )
    expect(result.written).toHaveLength(0)
    expect(result.message).toMatch(/unknown asset type/i)
  })
})
