// src/providers/gitlab.ts
import type { LibraryConfig, Provider, TreeEntry } from '../types.js'

function encodedPath(url: string): string {
  return new URL(url).pathname.replace(/^\//, '').replace(/\.git$/, '').replace(/\//g, '%2F')
}

function authHeaders(token?: string): Record<string, string> {
  const headers: Record<string, string> = {}
  if (token) headers['PRIVATE-TOKEN'] = token
  return headers
}

export class GitLabProvider implements Provider {
  private branchCache = new Map<string, string>()

  async resolveDefaultBranch(repo: LibraryConfig): Promise<string> {
    if (repo.branch) return repo.branch
    if (this.branchCache.has(repo.url)) return this.branchCache.get(repo.url)!

    const projectPath = encodedPath(repo.url)
    const hostname = new URL(repo.url).hostname
    const res = await fetch(`https://${hostname}/api/v4/projects/${projectPath}`, {
      headers: authHeaders(repo.token),
    })
    if (!res.ok) throw new Error(`GitLab API error ${res.status} for ${repo.url}`)
    const data = await res.json() as { default_branch: string }
    this.branchCache.set(repo.url, data.default_branch)
    return data.default_branch
  }

  async listTree(repo: LibraryConfig): Promise<TreeEntry[]> {
    const projectPath = encodedPath(repo.url)
    const hostname = new URL(repo.url).hostname
    const branch = await this.resolveDefaultBranch(repo)
    const root = repo.root ?? ''
    const all: TreeEntry[] = []
    let page = 1

    while (true) {
      const pathParam = root ? `&path=${encodeURIComponent(root)}` : ''
      const url = `https://${hostname}/api/v4/projects/${projectPath}/repository/tree?recursive=true&per_page=100&ref=${branch}${pathParam}&page=${page}`
      const res = await fetch(url, { headers: authHeaders(repo.token) })

      if (!res.ok) {
        if (res.status === 429) {
          const retryAfter = res.headers.get('retry-after') ?? 'unknown'
          throw new Error(`Rate limited by GitLab. Retry after ${retryAfter}s for ${repo.url}`)
        }
        throw new Error(`GitLab tree API error ${res.status} on page ${page} for ${repo.url}`)
      }

      const entries = await res.json() as Array<{ path: string; type: string }>
      all.push(...entries.map((e) => ({
        path: root ? `${root}/${e.path}` : e.path,
        type: e.type === 'tree' ? 'tree' as const : 'blob' as const,
      })))

      const nextPage = res.headers.get('x-next-page')
      if (!nextPage) break
      page = parseInt(nextPage, 10)
    }

    return all
  }

  async fetchFile(repo: LibraryConfig, path: string): Promise<string> {
    const projectPath = encodedPath(repo.url)
    const hostname = new URL(repo.url).hostname
    const branch = await this.resolveDefaultBranch(repo)
    const encodedFilePath = encodeURIComponent(path)
    const url = `https://${hostname}/api/v4/projects/${projectPath}/repository/files/${encodedFilePath}/raw?ref=${branch}`
    const res = await fetch(url, { headers: authHeaders(repo.token) })
    if (!res.ok) throw new Error(`Failed to fetch ${path} from ${repo.url}: ${res.status}`)
    return res.text()
  }
}
