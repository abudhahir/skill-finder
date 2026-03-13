// src/providers/github.ts
import type { LibraryConfig, Provider, TreeEntry } from '../types.js'

function ownerRepo(url: string): { owner: string; repo: string } {
  const parts = new URL(url).pathname.replace(/^\//, '').split('/')
  const owner = parts[0] ?? ''
  const repo = (parts[1] ?? '').replace(/\.git$/, '')
  return { owner, repo }
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/vnd.github+json' }
  if (token) headers['Authorization'] = `Bearer ${token}`
  return headers
}

export class GitHubProvider implements Provider {
  private branchCache = new Map<string, string>()

  async resolveDefaultBranch(repo: LibraryConfig): Promise<string> {
    if (repo.branch) return repo.branch
    if (this.branchCache.has(repo.url)) return this.branchCache.get(repo.url)!

    const { owner, repo: repoName } = ownerRepo(repo.url)
    const res = await fetch(`https://api.github.com/repos/${owner}/${repoName}`, {
      headers: authHeaders(repo.token),
    })
    if (!res.ok) throw new Error(`GitHub API error ${res.status} ${res.statusText} for ${repo.url}`)
    const data = await res.json() as { default_branch: string }
    this.branchCache.set(repo.url, data.default_branch)
    return data.default_branch
  }

  async listTree(repo: LibraryConfig): Promise<TreeEntry[]> {
    const { owner, repo: repoName } = ownerRepo(repo.url)
    const branch = await this.resolveDefaultBranch(repo)
    const root = repo.root ?? ''
    const treePath = root ? `${branch}:${root}` : branch
    const url = `https://api.github.com/repos/${owner}/${repoName}/git/trees/${treePath}?recursive=1`
    const res = await fetch(url, { headers: authHeaders(repo.token) })

    if (!res.ok) {
      if (res.status === 429) {
        const retryAfter = (res.headers as Headers).get('retry-after') ?? 'unknown'
        throw new Error(`Rate limited by GitHub. Retry after ${retryAfter}s for ${repo.url}`)
      }
      if (res.status === 404) {
        throw new Error(`Repository or path not found: ${repo.url}`)
      }
      throw new Error(`GitHub tree API error ${res.status} for ${repo.url}`)
    }

    const data = await res.json() as { tree: Array<{ path: string; type: string }> }
    return data.tree.map((entry) => ({
      path: root ? `${root}/${entry.path}` : entry.path,
      type: entry.type === 'tree' ? 'tree' : 'blob',
    }))
  }

  async fetchFile(repo: LibraryConfig, path: string): Promise<string> {
    const { owner, repo: repoName } = ownerRepo(repo.url)
    const branch = await this.resolveDefaultBranch(repo)
    const url = `https://raw.githubusercontent.com/${owner}/${repoName}/${branch}/${path}`
    const res = await fetch(url, { headers: authHeaders(repo.token) })
    if (!res.ok) throw new Error(`Failed to fetch ${path} from ${repo.url}: ${res.status}`)
    return res.text()
  }
}
