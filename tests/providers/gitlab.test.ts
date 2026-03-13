// tests/providers/gitlab.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GitLabProvider } from '../../src/providers/gitlab.js'
import type { LibraryConfig } from '../../src/types.js'

const repo: LibraryConfig = { name: 'test', url: 'https://gitlab.com/group/my-repo', branch: 'main' }

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

beforeEach(() => mockFetch.mockReset())

describe('GitLabProvider.listTree', () => {
  it('returns entries from a single page', async () => {
    const headers = new Headers({ 'x-next-page': '' })
    mockFetch.mockResolvedValueOnce({
      ok: true,
      headers,
      json: async () => [
        { path: 'skills/tdd/SKILL.md', type: 'blob' },
      ],
    })
    const p = new GitLabProvider()
    const entries = await p.listTree(repo)
    expect(entries).toHaveLength(1)
    expect(entries[0]!.path).toBe('skills/tdd/SKILL.md')
    expect(mockFetch).toHaveBeenCalledTimes(1)
  })

  it('paginates until x-next-page is empty', async () => {
    const headers1 = new Headers({ 'x-next-page': '2' })
    const headers2 = new Headers({ 'x-next-page': '' })
    mockFetch
      .mockResolvedValueOnce({ ok: true, headers: headers1, json: async () => [{ path: 'a.md', type: 'blob' }] })
      .mockResolvedValueOnce({ ok: true, headers: headers2, json: async () => [{ path: 'b.md', type: 'blob' }] })
    const p = new GitLabProvider()
    const entries = await p.listTree(repo)
    expect(entries).toHaveLength(2)
    expect(mockFetch).toHaveBeenCalledTimes(2)
    expect(mockFetch.mock.calls[1]![0]).toContain('page=2')
  })

  it('throws on mid-pagination failure', async () => {
    const headers1 = new Headers({ 'x-next-page': '2' })
    mockFetch
      .mockResolvedValueOnce({ ok: true, headers: headers1, json: async () => [{ path: 'a.md', type: 'blob' }] })
      .mockResolvedValueOnce({ ok: false, status: 500, statusText: 'Server Error', headers: new Headers() })
    const p = new GitLabProvider()
    await expect(p.listTree(repo)).rejects.toThrow('500')
  })
})

describe('GitLabProvider.fetchFile', () => {
  it('fetches file content via raw URL', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, text: async () => '# content' })
    const p = new GitLabProvider()
    const content = await p.fetchFile(repo, 'skills/tdd/SKILL.md')
    expect(content).toBe('# content')
    expect(mockFetch.mock.calls[0]![0]).toContain('group%2Fmy-repo')
    expect(mockFetch.mock.calls[0]![0]).toContain('skills%2Ftdd%2FSKILL.md')
  })
})
