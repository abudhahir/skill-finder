// tests/providers/github.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitHubProvider } from '../../src/providers/github.js'
import type { LibraryConfig } from '../../src/types.js'

const repo: LibraryConfig = { name: 'test', url: 'https://github.com/org/my-repo', branch: 'main' }

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => mockFetch.mockReset())

describe('GitHubProvider.resolveDefaultBranch', () => {
  it('returns branch from config when set', async () => {
    const p = new GitHubProvider()
    const branch = await p.resolveDefaultBranch(repo)
    expect(branch).toBe('main')
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches default_branch from API when branch not set', async () => {
    const p = new GitHubProvider()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ default_branch: 'master' }),
    })
    const branch = await p.resolveDefaultBranch({ ...repo, branch: undefined })
    expect(branch).toBe('master')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.github.com/repos/org/my-repo',
      expect.any(Object)
    )
  })

  it('throws on non-ok response', async () => {
    const p = new GitHubProvider()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 404, statusText: 'Not Found' })
    await expect(p.resolveDefaultBranch({ ...repo, branch: undefined })).rejects.toThrow('404')
  })
})

describe('GitHubProvider.listTree', () => {
  it('returns blobs from GitHub tree API', async () => {
    const p = new GitHubProvider()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [
          { path: 'skills/tdd/SKILL.md', type: 'blob' },
          { path: 'skills/tdd', type: 'tree' },
        ],
      }),
    })
    const entries = await p.listTree(repo)
    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ path: 'skills/tdd/SKILL.md', type: 'blob' })
  })

  it('prepends root to paths when root is set', async () => {
    const p = new GitHubProvider()
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        tree: [{ path: 'tdd/SKILL.md', type: 'blob' }],
      }),
    })
    const entries = await p.listTree({ ...repo, root: 'skills' })
    expect(entries[0]!.path).toBe('skills/tdd/SKILL.md')
  })

  it('throws with context on rate limit', async () => {
    const p = new GitHubProvider()
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429, headers: { get: () => '60' } })
    await expect(p.listTree(repo)).rejects.toThrow('Rate limited')
  })
})

describe('GitHubProvider.fetchFile', () => {
  it('fetches raw file content', async () => {
    const p = new GitHubProvider()
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '# Hello' })
    const content = await p.fetchFile(repo, 'skills/tdd/SKILL.md')
    expect(content).toBe('# Hello')
    expect(mockFetch).toHaveBeenCalledWith(
      'https://raw.githubusercontent.com/org/my-repo/main/skills/tdd/SKILL.md',
      expect.any(Object)
    )
  })
})
