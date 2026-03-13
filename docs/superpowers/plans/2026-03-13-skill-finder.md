# skill-finder Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a provider-agnostic MCP server that discovers and installs skills, agents, commands, prompts, hooks, and instructions from remote Git repositories into the current project directory.

**Architecture:** Session-level in-memory cache built from provider-agnostic tree API calls (GitHub/GitLab). Discovery is manifest-first with crawl fallback. Typed installers write assets to platform-correct directories (Claude Code `.claude/` or Copilot `.github/`).

**Tech Stack:** Node.js 18+, TypeScript (ESM), `@modelcontextprotocol/sdk`, `zod`, `js-yaml`, `gray-matter`, `vitest`

**Spec:** `docs/superpowers/specs/2026-03-13-skill-finder-design.md`

---

## File Map

```
src/
├── index.ts                      # MCP server entry: create server, register all tools, connect stdio
├── types.ts                      # All shared interfaces: LibraryConfig, AssetRecord, TreeEntry, Provider
├── config/
│   └── config.ts                 # Load/save/mutate ~/.skill-finder/libraries.json (0600 perms)
├── providers/
│   ├── registry.ts               # Detect provider from URL hostname, return Provider instance
│   ├── github.ts                 # GitHubProvider: resolveDefaultBranch, listTree, fetchFile
│   └── gitlab.ts                 # GitLabProvider: resolveDefaultBranch, listTree (paginated), fetchFile
├── discovery/
│   ├── frontmatter.ts            # Parse YAML frontmatter from .md string → partial AssetRecord fields
│   ├── manifest.ts               # Parse plugin.json / index.json / registry.yaml → AssetRecord[]
│   ├── crawl.ts                  # Tree crawl: filter paths, fetch frontmatter, expand skill dirs → AssetRecord[]
│   └── session-cache.ts          # Session-level Map<libraryName, AssetRecord[]>; lazy populate; refresh
├── search/
│   └── search.ts                 # Filter + rank AssetRecord[] by query string and optional filters
├── installer/
│   ├── install-skill.ts          # Write all skill files to .claude/skills/<dir-name>/
│   ├── install-agent.ts          # Write agent .md to .claude/agents/ or .github/agents/
│   ├── install-command.ts        # Write command .md to .claude/commands/
│   ├── install-prompt.ts         # Write prompt .md to .github/prompts/
│   ├── install-hook.ts           # Write hook files to .claude/hooks/
│   ├── install-instruction.ts    # Append to CLAUDE.md or AGENTS.md with heading dedup
│   └── install.ts                # General installer: cache lookup by (repo,path) → delegate to typed
└── tools/
    ├── library-tools.ts          # Tool handlers: add_library, remove_library, list_libraries, refresh_index
    ├── search-tool.ts            # Tool handler: search
    └── install-tools.ts          # Tool handlers: install, install_skill, install_agent, install_command,
                                  #   install_prompt, install_hook, install_instruction

tests/
├── config/config.test.ts
├── providers/
│   ├── github.test.ts
│   └── gitlab.test.ts
├── discovery/
│   ├── frontmatter.test.ts
│   ├── manifest.test.ts
│   └── crawl.test.ts
├── search/search.test.ts
└── installer/
    ├── install-skill.test.ts
    ├── install-agent.test.ts
    ├── install-command.test.ts
    ├── install-prompt.test.ts
    ├── install-hook.test.ts
    ├── install-instruction.test.ts
    └── install.test.ts
```

---

## Chunk 1: Project Scaffold

### Task 1: Initialize package.json and install dependencies

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Create package.json**

```json
{
  "name": "skill-finder",
  "version": "0.1.0",
  "type": "module",
  "main": "dist/index.js",
  "bin": { "skill-finder": "dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.0.0",
    "gray-matter": "^4.0.3",
    "js-yaml": "^4.1.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9",
    "@types/node": "^20.0.0",
    "tsx": "^4.0.0",
    "typescript": "^5.4.0",
    "vitest": "^1.6.0"
  }
}
```

- [ ] **Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
})
```

- [ ] **Step 4: Install dependencies**

```bash
npm install
```

Expected: `node_modules` created, no errors.

- [ ] **Step 5: Commit**

```bash
git add package.json tsconfig.json vitest.config.ts
git commit -m "feat: initialize TypeScript project scaffold"
```

---

### Task 2: Define shared types

**Files:**
- Create: `src/types.ts`

- [ ] **Step 1: Write types**

```typescript
// src/types.ts

export type AssetType = 'skill' | 'agent' | 'command' | 'prompt' | 'hook' | 'instruction'
export type Platform = 'claude-code' | 'copilot' | 'unknown'

export interface LibraryConfig {
  name: string
  url: string
  branch?: string
  token?: string
  root?: string
}

export interface TreeEntry {
  path: string
  type: 'blob' | 'tree'
}

export interface AssetRecord {
  name: string
  description: string
  tags: string[]
  type: AssetType
  platform: Platform
  repo: string
  path: string
  files: string[]
}

export interface Provider {
  resolveDefaultBranch(repo: LibraryConfig): Promise<string>
  listTree(repo: LibraryConfig): Promise<TreeEntry[]>
  fetchFile(repo: LibraryConfig, path: string): Promise<string>
}

export interface InstallParams {
  repo: string
  path: string
  platform?: Platform
  targetDir?: string
}

export interface InstallResult {
  written: string[]
  message: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types.ts
git commit -m "feat: add shared TypeScript types"
```

---

### Task 3: Create bare MCP server entry point

**Files:**
- Create: `src/index.ts`

- [ ] **Step 1: Write bare server (no tools yet)**

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'

export const server = new McpServer({
  name: 'skill-finder',
  version: '0.1.0',
})

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('skill-finder MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
```

- [ ] **Step 2: Verify it compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/index.ts
git commit -m "feat: add bare MCP server entry point"
```

---

## Chunk 2: Config Layer

### Task 4: Config load/save/mutate

**Files:**
- Create: `src/config/config.ts`
- Create: `tests/config/config.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/config/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  loadConfig,
  saveConfig,
  addLibrary,
  removeLibrary,
  configPath,
} from '../../src/config/config.js'
import type { LibraryConfig } from '../../src/types.js'

let testDir: string
let originalHome: string | undefined

beforeEach(() => {
  testDir = join(tmpdir(), `skill-finder-test-${Date.now()}`)
  mkdirSync(testDir, { recursive: true })
  originalHome = process.env['HOME']
  process.env['HOME'] = testDir
})

afterEach(() => {
  process.env['HOME'] = originalHome
  rmSync(testDir, { recursive: true, force: true })
})

describe('loadConfig', () => {
  it('returns empty libraries array when config file does not exist', async () => {
    const config = await loadConfig()
    expect(config.libraries).toEqual([])
  })

  it('returns parsed libraries when config exists', async () => {
    const lib: LibraryConfig = { name: 'test', url: 'https://github.com/a/b' }
    await saveConfig({ libraries: [lib] })
    const config = await loadConfig()
    expect(config.libraries).toHaveLength(1)
    expect(config.libraries[0]!.name).toBe('test')
  })

  it('normalizes trailing slashes on root field', async () => {
    const lib: LibraryConfig = { name: 'test', url: 'https://github.com/a/b', root: 'plugins/' }
    await saveConfig({ libraries: [lib] })
    const config = await loadConfig()
    expect(config.libraries[0]!.root).toBe('plugins')
  })
})

describe('saveConfig', () => {
  it('creates config file with 0600 permissions', async () => {
    await saveConfig({ libraries: [] })
    const path = configPath()
    expect(existsSync(path)).toBe(true)
    if (process.platform !== 'win32') {
      const mode = statSync(path).mode & 0o777
      expect(mode).toBe(0o600)
    }
  })
})

describe('addLibrary', () => {
  it('adds a library and derives name from URL when not provided', async () => {
    await addLibrary({ url: 'https://github.com/org/my-repo' })
    const config = await loadConfig()
    expect(config.libraries).toHaveLength(1)
    expect(config.libraries[0]!.name).toBe('my-repo')
  })

  it('uses provided name over derived name', async () => {
    await addLibrary({ url: 'https://github.com/org/my-repo', name: 'custom' })
    const config = await loadConfig()
    expect(config.libraries[0]!.name).toBe('custom')
  })

  it('does not add duplicate URLs', async () => {
    await addLibrary({ url: 'https://github.com/org/my-repo' })
    await addLibrary({ url: 'https://github.com/org/my-repo' })
    const config = await loadConfig()
    expect(config.libraries).toHaveLength(1)
  })

  it('normalizes trailing slash on root when adding', async () => {
    await addLibrary({ url: 'https://github.com/org/my-repo', name: 'r', root: 'plugins/' })
    const config = await loadConfig()
    expect(config.libraries[0]!.root).toBe('plugins')
  })
})

describe('removeLibrary', () => {
  it('removes library by name', async () => {
    await addLibrary({ url: 'https://github.com/org/my-repo', name: 'my-repo' })
    await removeLibrary('my-repo')
    const config = await loadConfig()
    expect(config.libraries).toHaveLength(0)
  })

  it('throws when library name not found', async () => {
    await expect(removeLibrary('nonexistent')).rejects.toThrow('not found')
  })
})
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/config/config.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement config.ts**

```typescript
// src/config/config.ts
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { homedir } from 'node:os'
import type { LibraryConfig } from '../types.js'

export interface Config {
  libraries: LibraryConfig[]
}

export function configPath(): string {
  return join(homedir(), '.skill-finder', 'libraries.json')
}

function normalizeRoot(root: string | undefined): string | undefined {
  if (!root) return undefined
  return root.replace(/\/+$/, '') || undefined
}

export async function loadConfig(): Promise<Config> {
  const path = configPath()
  if (!existsSync(path)) return { libraries: [] }
  const raw = await readFile(path, 'utf-8')
  const parsed = JSON.parse(raw) as Config
  return {
    libraries: parsed.libraries.map((lib) => ({
      ...lib,
      root: normalizeRoot(lib.root),
    })),
  }
}

export async function saveConfig(config: Config): Promise<void> {
  const path = configPath()
  await mkdir(dirname(path), { recursive: true })
  await writeFile(path, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 })
}

export async function addLibrary(
  opts: Partial<LibraryConfig> & { url: string }
): Promise<void> {
  const config = await loadConfig()
  const existing = config.libraries.find((l) => l.url === opts.url)
  if (existing) return
  const slug = new URL(opts.url).pathname.replace(/^\//, '').split('/').pop() ?? 'unknown'
  const lib: LibraryConfig = {
    name: opts.name ?? slug,
    url: opts.url,
    ...(opts.branch ? { branch: opts.branch } : {}),
    ...(opts.token ? { token: opts.token } : {}),
    ...(opts.root ? { root: normalizeRoot(opts.root) } : {}),
  }
  config.libraries.push(lib)
  await saveConfig(config)
}

export async function removeLibrary(name: string): Promise<void> {
  const config = await loadConfig()
  const idx = config.libraries.findIndex((l) => l.name === name)
  if (idx === -1) throw new Error(`Library "${name}" not found`)
  config.libraries.splice(idx, 1)
  await saveConfig(config)
}
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/config/config.test.ts
```

Expected: all PASS

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/config/config.ts tests/config/config.test.ts
git commit -m "feat: add config load/save/mutate layer"
```

---

## Chunk 3: Provider Layer

### Task 5: Provider registry (URL → Provider instance)

**Files:**
- Create: `src/providers/registry.ts`

- [ ] **Step 1: Write registry**

```typescript
// src/providers/registry.ts
import type { Provider } from '../types.js'
import { GitHubProvider } from './github.js'
import { GitLabProvider } from './gitlab.js'

export function getProvider(url: string): Provider {
  const hostname = new URL(url).hostname
  if (hostname === 'github.com') return new GitHubProvider()
  if (hostname === 'gitlab.com' || hostname.endsWith('.gitlab.com')) return new GitLabProvider()
  throw new Error(`Unsupported provider hostname: "${hostname}". Supported: github.com, gitlab.com`)
}
```

- [ ] **Step 2: Commit (after providers are implemented below)**

Deferred — commit together with Task 6 and 7.

---

### Task 6: GitHubProvider

**Files:**
- Create: `src/providers/github.ts`
- Create: `tests/providers/github.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/providers/github.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement GitHubProvider**

```typescript
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
      if (res.status === 404 && res.statusText.includes('Not Found')) {
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
```

- [ ] **Step 4: Run tests — verify they pass**

```bash
npx vitest run tests/providers/github.test.ts
```

Expected: all PASS

---

### Task 7: GitLabProvider

**Files:**
- Create: `src/providers/gitlab.ts`
- Create: `tests/providers/gitlab.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run tests — verify they fail**

```bash
npx vitest run tests/providers/gitlab.test.ts
```

Expected: FAIL (module not found)

- [ ] **Step 3: Implement GitLabProvider**

```typescript
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
```

- [ ] **Step 4: Run all provider tests**

```bash
npx vitest run tests/providers/
```

Expected: all PASS

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/providers/ tests/providers/
git commit -m "feat: add provider abstraction with GitHub and GitLab implementations"
```

---

## Chunk 4: Discovery Engine

### Task 8: Frontmatter parser

**Files:**
- Create: `src/discovery/frontmatter.ts`
- Create: `tests/discovery/frontmatter.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/discovery/frontmatter.test.ts
import { describe, it, expect } from 'vitest'
import { parseFrontmatter } from '../../src/discovery/frontmatter.js'

describe('parseFrontmatter', () => {
  it('parses name, description, tags, type from frontmatter', () => {
    const md = `---
name: tdd
description: Test-driven development
tags: [testing, tdd]
type: skill
---
# Content here`
    const result = parseFrontmatter(md)
    expect(result.name).toBe('tdd')
    expect(result.description).toBe('Test-driven development')
    expect(result.tags).toEqual(['testing', 'tdd'])
    expect(result.type).toBe('skill')
  })

  it('returns empty object when no frontmatter', () => {
    const result = parseFrontmatter('# Just a heading\nNo frontmatter.')
    expect(result.name).toBeUndefined()
  })

  it('handles missing optional fields gracefully', () => {
    const md = `---
name: my-agent
---`
    const result = parseFrontmatter(md)
    expect(result.name).toBe('my-agent')
    expect(result.tags).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/discovery/frontmatter.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// src/discovery/frontmatter.ts
import matter from 'gray-matter'
import type { AssetType, Platform } from '../types.js'

export interface FrontmatterData {
  name?: string
  description?: string
  tags?: string[]
  type?: AssetType
  platform?: Platform
}

export function parseFrontmatter(content: string): FrontmatterData {
  try {
    const { data } = matter(content)
    return {
      name: typeof data['name'] === 'string' ? data['name'] : undefined,
      description: typeof data['description'] === 'string' ? data['description'] : undefined,
      tags: Array.isArray(data['tags']) ? data['tags'] as string[] : undefined,
      type: data['type'] as AssetType | undefined,
      platform: data['platform'] as Platform | undefined,
    }
  } catch {
    return {}
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/discovery/frontmatter.test.ts
```

Expected: all PASS

---

### Task 9: Manifest parser

**Files:**
- Create: `src/discovery/manifest.ts`
- Create: `tests/discovery/manifest.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/discovery/manifest.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// src/discovery/manifest.ts
import yaml from 'js-yaml'
import type { AssetRecord, AssetType, Platform } from '../types.js'

interface ManifestEntry {
  name?: unknown
  description?: unknown
  tags?: unknown
  type?: unknown
  platform?: unknown
  files?: unknown
}

interface ManifestFile {
  assets?: ManifestEntry[]
}

export function parseManifest(
  content: string,
  filename: string,
  repoName: string
): AssetRecord[] | null {
  let parsed: ManifestFile
  try {
    if (filename.endsWith('.yaml') || filename.endsWith('.yml')) {
      parsed = yaml.load(content) as ManifestFile
    } else {
      parsed = JSON.parse(content) as ManifestFile
    }
  } catch {
    return null
  }

  if (!parsed?.assets || !Array.isArray(parsed.assets)) return null

  const records: AssetRecord[] = []
  for (const entry of parsed.assets) {
    if (typeof entry.name !== 'string' || typeof entry.type !== 'string') return null
    if (!Array.isArray(entry.files) || entry.files.length === 0) return null

    const files = entry.files as string[]
    records.push({
      name: entry.name,
      description: typeof entry.description === 'string' ? entry.description : '',
      tags: Array.isArray(entry.tags) ? entry.tags as string[] : [],
      type: entry.type as AssetType,
      platform: typeof entry.platform === 'string' ? entry.platform as Platform : 'unknown',
      repo: repoName,
      path: files[0]!,
      files,
    })
  }
  return records
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/discovery/manifest.test.ts
```

Expected: all PASS

---

### Task 10: Crawl engine + session cache

**Files:**
- Create: `src/discovery/crawl.ts`
- Create: `src/discovery/session-cache.ts`
- Create: `tests/discovery/crawl.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/discovery/crawl.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement crawl.ts**

```typescript
// src/discovery/crawl.ts
import type { AssetRecord, AssetType, LibraryConfig, Platform, Provider, TreeEntry } from '../types.js'
import { parseFrontmatter } from './frontmatter.js'
import { parseManifest } from './manifest.js'

const MANIFEST_FILES = ['plugin.json', 'index.json', 'registry.yaml', 'registry.yml']

interface PathRule {
  pattern: (path: string) => boolean
  type: AssetType
  platform: Platform
}

const PATH_RULES: PathRule[] = [
  { pattern: (p) => /^skills\/.+\/SKILL\.md$/i.test(p), type: 'skill', platform: 'claude-code' },
  { pattern: (p) => /^agents\/[^/]+\.md$/i.test(p), type: 'agent', platform: 'claude-code' },
  { pattern: (p) => /^commands\/[^/]+\.md$/i.test(p), type: 'command', platform: 'claude-code' },
  { pattern: (p) => p === 'hooks/hooks.json', type: 'hook', platform: 'claude-code' },
  { pattern: (p) => /^\.github\/agents\/[^/]+\.agent\.md$/i.test(p), type: 'agent', platform: 'copilot' },
  { pattern: (p) => /^\.github\/prompts\/[^/]+\.prompt\.md$/i.test(p), type: 'prompt', platform: 'copilot' },
  { pattern: (p) => p === 'AGENTS.md' || p.endsWith('.instructions.md'), type: 'instruction', platform: 'copilot' },
]

function matchRule(path: string): PathRule | undefined {
  return PATH_RULES.find((r) => r.pattern(path))
}

function stemName(path: string): string {
  const base = path.split('/').pop() ?? path
  return base.replace(/\.(agent\.md|prompt\.md|md|json)$/i, '')
}

function skillDirFiles(tree: TreeEntry[], skillPath: string): string[] {
  const dir = skillPath.replace(/\/SKILL\.md$/i, '')
  return tree.filter((e) => e.type === 'blob' && e.path.startsWith(dir + '/')).map((e) => e.path)
}

export async function discoverLibrary(
  repo: LibraryConfig,
  provider: Provider,
  warnings: string[] = []
): Promise<AssetRecord[]> {
  const tree = await provider.listTree(repo)
  const root = repo.root ?? ''

  // Try manifest first
  for (const mf of MANIFEST_FILES) {
    const mfPath = root ? `${root}/${mf}` : mf
    const treeEntry = tree.find((e) => e.path === mfPath && e.type === 'blob')
    if (treeEntry) {
      try {
        const content = await provider.fetchFile(repo, mfPath)
        const records = parseManifest(content, mf, repo.name)
        if (records) return records
        warnings.push(`Manifest ${mfPath} in ${repo.name} is malformed — falling back to crawl`)
      } catch {
        warnings.push(`Could not fetch manifest ${mfPath} in ${repo.name} — falling back to crawl`)
      }
      break
    }
  }

  // Crawl fallback
  const records: AssetRecord[] = []
  for (const entry of tree) {
    if (entry.type !== 'blob') continue
    const rule = matchRule(entry.path)
    if (!rule) continue

    // Special handling: hooks/hooks.json → one asset per hook entry
    if (rule.type === 'hook') {
      try {
        const content = await provider.fetchFile(repo, entry.path)
        const parsed = JSON.parse(content) as { hooks?: Array<{ name?: string; description?: string }> }
        const hookEntries = parsed.hooks ?? []
        for (const hook of hookEntries) {
          records.push({
            name: hook.name ?? 'hook',
            description: hook.description ?? '',
            tags: [],
            type: 'hook',
            platform: 'claude-code',
            repo: repo.name,
            path: entry.path,
            files: [entry.path],
          })
        }
      } catch {
        warnings.push(`Could not parse ${entry.path} in ${repo.name}`)
      }
      continue
    }

    let name = stemName(entry.path)
    let description = ''
    let tags: string[] = []
    let platform = rule.platform

    // Parse frontmatter for .md files
    if (entry.path.endsWith('.md')) {
      try {
        const content = await provider.fetchFile(repo, entry.path)
        const fm = parseFrontmatter(content)
        name = fm.name ?? name
        description = fm.description ?? ''
        tags = fm.tags ?? []
        platform = fm.platform ?? platform
      } catch {
        // Use defaults derived from path
      }
    }

    const files = rule.type === 'skill'
      ? skillDirFiles(tree, entry.path)
      : [entry.path]

    records.push({
      name,
      description,
      tags,
      type: rule.type,
      platform,
      repo: repo.name,
      path: entry.path,
      files: files.length > 0 ? files : [entry.path],
    })
  }

  return records
}
```

- [ ] **Step 4: Implement session-cache.ts**

```typescript
// src/discovery/session-cache.ts
import type { AssetRecord, LibraryConfig, Provider } from '../types.js'
import { discoverLibrary } from './crawl.js'
import { getProvider } from '../providers/registry.js'

const cache = new Map<string, AssetRecord[]>()
export const warnings: string[] = []

export async function getOrPopulate(libraries: LibraryConfig[]): Promise<AssetRecord[]> {
  const all: AssetRecord[] = []
  for (const lib of libraries) {
    if (!cache.has(lib.name)) {
      const provider = getProvider(lib.url)
      const records = await discoverLibrary(lib, provider, warnings)
      cache.set(lib.name, records)
    }
    all.push(...(cache.get(lib.name) ?? []))
  }
  return all
}

export async function refreshLibrary(lib: LibraryConfig): Promise<AssetRecord[]> {
  const provider = getProvider(lib.url)
  const records = await discoverLibrary(lib, provider, warnings)
  cache.set(lib.name, records)
  return records
}

export function clearCache(libraryName?: string): void {
  if (libraryName) {
    cache.delete(libraryName)
  } else {
    cache.clear()
  }
}

export function getCached(libraryName: string): AssetRecord[] | undefined {
  return cache.get(libraryName)
}

export function findAsset(repo: string, path: string): AssetRecord | undefined {
  return cache.get(repo)?.find((r) => r.path === path)
}
```

- [ ] **Step 5: Run all discovery tests**

```bash
npx vitest run tests/discovery/
```

Expected: all PASS

- [ ] **Step 6: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add src/discovery/ tests/discovery/
git commit -m "feat: add discovery engine with frontmatter, manifest, crawl, and session cache"
```

---

## Chunk 5: Search

### Task 11: Search ranking

**Files:**
- Create: `src/search/search.ts`
- Create: `tests/search/search.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/search/search.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement**

```typescript
// src/search/search.ts
import type { AssetRecord, AssetType, Platform } from '../types.js'

export interface SearchParams {
  query: string
  type?: AssetType
  library?: string
  platform?: Platform
  limit?: number
}

function score(record: AssetRecord, q: string): number {
  if (!q) return 1
  const lq = q.toLowerCase()
  if (record.name.toLowerCase() === lq) return 3
  if (record.name.toLowerCase().includes(lq)) return 2
  if (record.tags.some((t) => t.toLowerCase().includes(lq))) return 1.5
  if (record.description.toLowerCase().includes(lq)) return 1
  return 0
}

export function searchAssets(records: AssetRecord[], params: SearchParams): AssetRecord[] {
  const { query, type, library, platform, limit = 20 } = params

  return records
    .filter((r) => {
      if (type && r.type !== type) return false
      if (library && r.repo !== library) return false
      if (platform && r.platform !== platform) return false
      return score(r, query) > 0
    })
    .map((r) => ({ record: r, score: score(r, query) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.record)
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/search/search.test.ts
```

Expected: all PASS

- [ ] **Step 5: Commit**

```bash
git add src/search/ tests/search/
git commit -m "feat: add search ranking with name/tag/description scoring"
```

---

## Chunk 6: Installers

### Task 12: Shared file-write utility + install-skill

**Files:**
- Create: `src/installer/install-skill.ts`
- Create: `tests/installer/install-skill.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// tests/installer/install-skill.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installSkill } from '../../src/installer/install-skill.js'
import type { AssetRecord, Provider } from '../../src/types.js'

let testCwd: string

const provider: Provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async (_, path) => path.endsWith('SKILL.md') ? '# Skill content' : '# Other',
}

const asset: AssetRecord = {
  name: 'tdd',
  description: 'TDD skill',
  tags: ['testing'],
  type: 'skill',
  platform: 'claude-code',
  repo: 'myrepo',
  path: 'skills/tdd/SKILL.md',
  files: ['skills/tdd/SKILL.md', 'skills/tdd/examples.md'],
}

const repoConfig = { name: 'myrepo', url: 'https://github.com/a/b' }

beforeEach(() => {
  testCwd = join(tmpdir(), `skill-finder-test-${Date.now()}`)
  mkdirSync(testCwd, { recursive: true })
})

afterEach(() => rmSync(testCwd, { recursive: true, force: true }))

describe('installSkill', () => {
  it('writes all skill files to .claude/skills/<dir-name>/', async () => {
    const result = await installSkill(asset, repoConfig, provider, testCwd)
    expect(result.written).toHaveLength(2)
    expect(existsSync(join(testCwd, '.claude/skills/tdd/SKILL.md'))).toBe(true)
    expect(existsSync(join(testCwd, '.claude/skills/tdd/examples.md'))).toBe(true)
  })

  it('overwrites existing files and returns update message', async () => {
    await installSkill(asset, repoConfig, provider, testCwd)
    const result = await installSkill(asset, repoConfig, provider, testCwd)
    expect(result.message).toMatch(/updated/i)
  })

  it('respects custom targetDir', async () => {
    const custom = join(testCwd, 'my-skills')
    const result = await installSkill(asset, repoConfig, provider, testCwd, custom)
    expect(existsSync(join(custom, 'tdd/SKILL.md'))).toBe(true)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/installer/install-skill.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement install-skill.ts**

```typescript
// src/installer/install-skill.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installSkill(
  asset: AssetRecord,
  repo: LibraryConfig,
  provider: Provider,
  cwd: string,
  targetDir?: string
): Promise<InstallResult> {
  // Derive dir name from the path component containing SKILL.md
  const dirName = asset.path.split('/').slice(-2, -1)[0] ?? asset.name
  const base = targetDir ?? join(cwd, '.claude', 'skills', dirName)
  const isUpdate = existsSync(base)

  await mkdir(base, { recursive: true })
  const written: string[] = []

  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }

  return {
    written,
    message: isUpdate
      ? `Updated skill "${asset.name}" in ${base}`
      : `Installed skill "${asset.name}" to ${base}`,
  }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/installer/install-skill.test.ts
```

Expected: all PASS

---

### Task 13: install-agent, install-command, install-prompt, install-hook

**Files:**
- Create: `src/installer/install-agent.ts`
- Create: `src/installer/install-command.ts`
- Create: `src/installer/install-prompt.ts`
- Create: `src/installer/install-hook.ts`
- Create: `tests/installer/install-agent.test.ts`

- [ ] **Step 1: Write test for install-agent (representative)**

```typescript
// tests/installer/install-agent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, rmSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { installAgent } from '../../src/installer/install-agent.js'
import type { AssetRecord, Provider } from '../../src/types.js'

let testCwd: string

const provider: Provider = {
  resolveDefaultBranch: async () => 'main',
  listTree: async () => [],
  fetchFile: async () => '# Agent content',
}

beforeEach(() => {
  testCwd = join(tmpdir(), `sf-test-${Date.now()}`)
  mkdirSync(testCwd, { recursive: true })
})
afterEach(() => rmSync(testCwd, { recursive: true, force: true }))

const claudeAgent: AssetRecord = {
  name: 'planner', description: '', tags: [], type: 'agent',
  platform: 'claude-code', repo: 'r', path: 'agents/planner.md', files: ['agents/planner.md'],
}

const copilotAgent: AssetRecord = {
  ...claudeAgent, platform: 'copilot',
  path: '.github/agents/planner.agent.md', files: ['.github/agents/planner.agent.md'],
}

describe('installAgent', () => {
  it('writes to .claude/agents/ for claude-code', async () => {
    await installAgent(claudeAgent, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(existsSync(join(testCwd, '.claude/agents/planner.md'))).toBe(true)
  })

  it('writes to .github/agents/ for copilot', async () => {
    await installAgent(copilotAgent, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(existsSync(join(testCwd, '.github/agents/planner.agent.md'))).toBe(true)
  })

  it('asks for platform when platform is unknown', async () => {
    const unknown = { ...claudeAgent, platform: 'unknown' as const }
    const result = await installAgent(unknown, { name: 'r', url: 'https://github.com/a/b' }, provider, testCwd)
    expect(result.message).toMatch(/please specify.*platform/i)
    expect(result.written).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/installer/install-agent.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement install-agent.ts**

```typescript
// src/installer/install-agent.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installAgent(
  asset: AssetRecord,
  repo: LibraryConfig,
  provider: Provider,
  cwd: string,
  targetDir?: string
): Promise<InstallResult> {
  if (asset.platform === 'unknown') {
    return { written: [], message: 'Please specify a platform: "claude-code" or "copilot"' }
  }

  const base = targetDir ?? (
    asset.platform === 'claude-code'
      ? join(cwd, '.claude', 'agents')
      : join(cwd, '.github', 'agents')
  )

  await mkdir(base, { recursive: true })
  const written: string[] = []

  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }

  return { written, message: `Installed agent "${asset.name}" to ${base}` }
}
```

- [ ] **Step 4: Implement install-command.ts, install-prompt.ts, install-hook.ts**

```typescript
// src/installer/install-command.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installCommand(
  asset: AssetRecord, repo: LibraryConfig, provider: Provider, cwd: string, targetDir?: string
): Promise<InstallResult> {
  const base = targetDir ?? join(cwd, '.claude', 'commands')
  await mkdir(base, { recursive: true })
  const written: string[] = []
  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }
  return { written, message: `Installed command "${asset.name}" to ${base}` }
}
```

```typescript
// src/installer/install-prompt.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installPrompt(
  asset: AssetRecord, repo: LibraryConfig, provider: Provider, cwd: string, targetDir?: string
): Promise<InstallResult> {
  const base = targetDir ?? join(cwd, '.github', 'prompts')
  await mkdir(base, { recursive: true })
  const written: string[] = []
  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }
  return { written, message: `Installed prompt "${asset.name}" to ${base}` }
}
```

```typescript
// src/installer/install-hook.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installHook(
  asset: AssetRecord, repo: LibraryConfig, provider: Provider, cwd: string, targetDir?: string
): Promise<InstallResult> {
  const base = targetDir ?? join(cwd, '.claude', 'hooks')
  await mkdir(base, { recursive: true })
  const written: string[] = []
  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }
  return { written, message: `Installed hook "${asset.name}" to ${base}` }
}
```

- [ ] **Step 5: Run agent tests**

```bash
npx vitest run tests/installer/install-agent.test.ts
```

Expected: all PASS

---

### Task 14: install-instruction (heading dedup)

**Files:**
- Create: `src/installer/install-instruction.ts`
- Create: `tests/installer/install-instruction.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/installer/install-instruction.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement install-instruction.ts**

```typescript
// src/installer/install-instruction.ts
import { readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

function hasHeading(fileContent: string, name: string): boolean {
  const lines = fileContent.split('\n')
  for (const line of lines) {
    const match = line.match(/^#{1,3}\s+(.+?)\s*$/)
    if (match && match[1]!.toLowerCase() === name.toLowerCase()) return true
  }
  return false
}

export async function installInstruction(
  asset: AssetRecord,
  repo: LibraryConfig,
  provider: Provider,
  cwd: string,
  targetDir?: string
): Promise<InstallResult> {
  const targetFile = targetDir
    ? join(targetDir, asset.platform === 'copilot' ? 'AGENTS.md' : 'CLAUDE.md')
    : join(cwd, asset.platform === 'copilot' ? 'AGENTS.md' : 'CLAUDE.md')

  const assetContent = await provider.fetchFile(repo, asset.path)

  if (!existsSync(targetFile)) {
    await writeFile(targetFile, assetContent, 'utf-8')
    return { written: [targetFile], message: `Installed instruction "${asset.name}" to ${targetFile}` }
  }

  const existing = await readFile(targetFile, 'utf-8')
  if (hasHeading(existing, asset.name)) {
    return {
      written: [],
      message: `"${asset.name}" is already installed in ${targetFile} — skipping`,
    }
  }

  // Strip the asset content's own leading heading to avoid double-heading when appending
  const strippedContent = assetContent.replace(/^#{1,3}\s+.+\n+/, '')
  const separator = existing.endsWith('\n') ? '\n' : '\n\n'
  await writeFile(targetFile, `${existing}${separator}## ${asset.name}\n\n${strippedContent}`, 'utf-8')
  return { written: [targetFile], message: `Appended instruction "${asset.name}" to ${targetFile}` }
}
```

- [ ] **Step 4: Run — verify pass**

```bash
npx vitest run tests/installer/install-instruction.test.ts
```

Expected: all PASS

---

### Task 15: install (general — cache lookup + delegate)

**Files:**
- Create: `src/installer/install.ts`
- Create: `tests/installer/install.test.ts`

- [ ] **Step 1: Write failing tests**

```typescript
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
```

- [ ] **Step 2: Run — verify fail**

```bash
npx vitest run tests/installer/install.test.ts
```

Expected: FAIL

- [ ] **Step 3: Implement install.ts**

```typescript
// src/installer/install.ts
import type { AssetRecord, InstallParams, InstallResult, LibraryConfig, Provider } from '../types.js'
import { findAsset, getOrPopulate } from '../discovery/session-cache.js'
import { installSkill } from './install-skill.js'
import { installAgent } from './install-agent.js'
import { installCommand } from './install-command.js'
import { installPrompt } from './install-prompt.js'
import { installHook } from './install-hook.js'
import { installInstruction } from './install-instruction.js'

export async function install(
  params: InstallParams,
  libraries: LibraryConfig[],
  provider: Provider,
  cwd: string
): Promise<InstallResult> {
  let asset = findAsset(params.repo, params.path)

  if (!asset) {
    await getOrPopulate(libraries)
    asset = findAsset(params.repo, params.path)
  }

  if (!asset) {
    return { written: [], message: `Asset not found: repo="${params.repo}" path="${params.path}"` }
  }

  const resolved: AssetRecord = {
    ...asset,
    platform: params.platform ?? asset.platform,
  }

  const repo = libraries.find((l) => l.name === params.repo)
  if (!repo) return { written: [], message: `Library "${params.repo}" not registered` }

  switch (resolved.type) {
    case 'skill': return installSkill(resolved, repo, provider, cwd, params.targetDir)
    case 'agent': return installAgent(resolved, repo, provider, cwd, params.targetDir)
    case 'command': return installCommand(resolved, repo, provider, cwd, params.targetDir)
    case 'prompt': return installPrompt(resolved, repo, provider, cwd, params.targetDir)
    case 'hook': return installHook(resolved, repo, provider, cwd, params.targetDir)
    case 'instruction': return installInstruction(resolved, repo, provider, cwd, params.targetDir)
    default:
      return { written: [], message: `Unknown asset type "${resolved.type}". Please specify one of: skill, agent, command, prompt, hook, instruction` }
  }
}
```

- [ ] **Step 4: Run all installer tests**

```bash
npx vitest run tests/installer/
```

Expected: all PASS

- [ ] **Step 5: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/installer/ tests/installer/
git commit -m "feat: add typed installers and general install dispatcher"
```

---

## Chunk 7: MCP Tool Wiring

### Task 16: Library tool handlers

**Files:**
- Create: `src/tools/library-tools.ts`

- [ ] **Step 1: Implement library-tools.ts**

```typescript
// src/tools/library-tools.ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig, addLibrary, removeLibrary, saveConfig } from '../config/config.js'
import { getOrPopulate, refreshLibrary, clearCache } from '../discovery/session-cache.js'
import type { AssetType } from '../types.js'

export function registerLibraryTools(server: McpServer): void {
  server.registerTool(
    'add_library',
    {
      description: 'Register a Git repository as a skill library source',
      inputSchema: z.object({
        url: z.string().describe('Full HTTPS URL to the repository'),
        branch: z.string().optional().describe('Branch name (defaults to repo default)'),
        token: z.string().optional().describe('Personal access token for private repos'),
        name: z.string().optional().describe('Human-readable name (defaults to repo slug)'),
        root: z.string().optional().describe('Subdirectory to narrow crawl scope'),
      }),
    },
    async (params) => {
      await addLibrary(params)
      return { content: [{ type: 'text', text: `Library added: ${params.name ?? params.url}` }] }
    }
  )

  server.registerTool(
    'remove_library',
    {
      description: 'Remove a registered library by name',
      inputSchema: z.object({
        name: z.string().describe('Library name to remove'),
      }),
    },
    async ({ name }) => {
      try {
        await removeLibrary(name)
        return { content: [{ type: 'text', text: `Library "${name}" removed` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: (e as Error).message }], isError: true }
      }
    }
  )

  server.registerTool(
    'list_libraries',
    {
      description: 'List all registered libraries',
      inputSchema: z.object({}),
    },
    async () => {
      const config = await loadConfig()
      const redacted = config.libraries.map((l) => ({
        ...l,
        token: l.token ? '***' : undefined,
      }))
      return { content: [{ type: 'text', text: JSON.stringify(redacted, null, 2) }] }
    }
  )

  server.registerTool(
    'refresh_index',
    {
      description: 'Re-crawl one or all libraries to refresh the session index',
      inputSchema: z.object({
        library: z.string().optional().describe('Library name to refresh (omit for all)'),
      }),
    },
    async ({ library }) => {
      const config = await loadConfig()
      const targets = library
        ? config.libraries.filter((l) => l.name === library)
        : config.libraries

      if (library && targets.length === 0) {
        return { content: [{ type: 'text', text: `Library "${library}" not found` }], isError: true }
      }

      clearCache(library)
      const summary: Array<{ library: string; assetCount: number; byType: Record<string, number> }> = []

      for (const lib of targets) {
        const records = await refreshLibrary(lib)
        const byType: Record<string, number> = {}
        for (const r of records) {
          byType[r.type] = (byType[r.type] ?? 0) + 1
        }
        summary.push({ library: lib.name, assetCount: records.length, byType })
      }

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
  )
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit
```

Expected: no errors.

---

### Task 17: Search tool handler

**Files:**
- Create: `src/tools/search-tool.ts`

- [ ] **Step 1: Implement search-tool.ts**

```typescript
// src/tools/search-tool.ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from '../config/config.js'
import { getOrPopulate, warnings } from '../discovery/session-cache.js'
import { searchAssets } from '../search/search.js'

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    'search',
    {
      description: 'Search for skills, agents, commands, prompts, hooks, or instructions across all registered libraries',
      inputSchema: z.object({
        query: z.string().describe('Search query — matched against name, tags, and description'),
        type: z.enum(['skill', 'agent', 'command', 'prompt', 'hook', 'instruction']).optional(),
        library: z.string().optional().describe('Limit search to a specific library name'),
        platform: z.enum(['claude-code', 'copilot']).optional(),
        limit: z.number().int().positive().default(20).describe('Maximum results to return'),
      }),
    },
    async (params) => {
      const config = await loadConfig()
      if (config.libraries.length === 0) {
        return { content: [{ type: 'text', text: 'No libraries registered. Use add_library to add one.' }] }
      }

      const records = await getOrPopulate(config.libraries)
      const results = searchAssets(records, params)
      const response = {
        results,
        warnings: warnings.length > 0 ? warnings : undefined,
        hint: 'Pass asset.repo and asset.path to any install tool to install an asset.',
      }
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] }
    }
  )
}
```

---

### Task 18: Install tool handlers + wire everything into index.ts

**Files:**
- Create: `src/tools/install-tools.ts`
- Modify: `src/index.ts`

- [ ] **Step 1: Implement install-tools.ts**

```typescript
// src/tools/install-tools.ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from '../config/config.js'
import { getProvider } from '../providers/registry.js'
import { install } from '../installer/install.js'
import { installSkill } from '../installer/install-skill.js'
import { installAgent } from '../installer/install-agent.js'
import { installCommand } from '../installer/install-command.js'
import { installPrompt } from '../installer/install-prompt.js'
import { installHook } from '../installer/install-hook.js'
import { installInstruction } from '../installer/install-instruction.js'
import { findAsset, getOrPopulate } from '../discovery/session-cache.js'
import type { AssetRecord, Platform } from '../types.js'

const installParamsSchema = z.object({
  repo: z.string().describe('Library name (asset.repo from search result)'),
  path: z.string().describe('Asset path within repo (asset.path from search result)'),
  platform: z.enum(['claude-code', 'copilot']).optional(),
  target_dir: z.string().optional().describe('Override default install directory'),
})

async function resolveAsset(repo: string, path: string, libraries: Awaited<ReturnType<typeof loadConfig>>['libraries']): Promise<AssetRecord | null> {
  let asset = findAsset(repo, path)
  if (!asset) {
    await getOrPopulate(libraries)
    asset = findAsset(repo, path)
  }
  return asset ?? null
}

function resultToContent(result: { written: string[]; message: string }) {
  return { content: [{ type: 'text' as const, text: result.message }] }
}

export function registerInstallTools(server: McpServer): void {
  server.registerTool(
    'install',
    {
      description: 'Install any asset by repo and path — detects type automatically',
      inputSchema: installParamsSchema,
    },
    async ({ repo, path, platform, target_dir }) => {
      const config = await loadConfig()
      const libConfig = config.libraries.find((l) => l.name === repo)
      if (!libConfig) {
        return { content: [{ type: 'text' as const, text: `Library "${repo}" not registered. Use add_library to add it.` }], isError: true }
      }
      const provider = getProvider(libConfig.url)
      const result = await install(
        { repo, path, platform: platform as Platform | undefined, targetDir: target_dir },
        config.libraries, provider, process.cwd()
      )
      const isError = result.written.length === 0 && result.message.toLowerCase().includes('not found')
      return { content: [{ type: 'text' as const, text: result.message }], ...(isError ? { isError: true } : {}) }
    }
  )

  const typedInstaller = (
    toolName: string,
    description: string,
    handler: (asset: AssetRecord, repo: Awaited<ReturnType<typeof loadConfig>>['libraries'][0], provider: ReturnType<typeof getProvider>, cwd: string, targetDir?: string) => Promise<{ written: string[]; message: string }>
  ) => {
    server.registerTool(toolName, { description, inputSchema: installParamsSchema }, async ({ repo, path, platform, target_dir }) => {
      const config = await loadConfig()
      const libConfig = config.libraries.find((l) => l.name === repo)
      if (!libConfig) return { content: [{ type: 'text' as const, text: `Library "${repo}" not registered` }], isError: true }

      const asset = await resolveAsset(repo, path, config.libraries)
      if (!asset) return { content: [{ type: 'text' as const, text: `Asset not found: repo="${repo}" path="${path}"` }], isError: true }

      const resolved = { ...asset, platform: (platform as Platform | undefined) ?? asset.platform }
      const provider = getProvider(libConfig.url)
      const result = await handler(resolved, libConfig, provider, process.cwd(), target_dir)
      return resultToContent(result)
    })
  }

  typedInstaller('install_skill', 'Install a skill to .claude/skills/', installSkill)
  typedInstaller('install_agent', 'Install an agent to .claude/agents/ or .github/agents/', installAgent)
  typedInstaller('install_command', 'Install a slash command to .claude/commands/', installCommand)
  typedInstaller('install_prompt', 'Install a prompt file to .github/prompts/', installPrompt)
  typedInstaller('install_hook', 'Install a hook to .claude/hooks/', installHook)
  typedInstaller('install_instruction', 'Append an instruction to CLAUDE.md or AGENTS.md', installInstruction)
}
```

- [ ] **Step 2: Wire all tools into index.ts**

```typescript
// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerLibraryTools } from './tools/library-tools.js'
import { registerSearchTool } from './tools/search-tool.js'
import { registerInstallTools } from './tools/install-tools.js'

export const server = new McpServer({
  name: 'skill-finder',
  version: '0.1.0',
})

registerLibraryTools(server)
registerSearchTool(server)
registerInstallTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('skill-finder MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
```

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all PASS

- [ ] **Step 4: Build**

```bash
npm run build
```

Expected: `dist/` created with no TypeScript errors.

- [ ] **Step 5: Smoke test — verify server starts**

```bash
echo '{"jsonrpc":"2.0","method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1"}},"id":1}' | node dist/index.js
```

Expected: JSON response with `result.serverInfo.name` = `"skill-finder"`

- [ ] **Step 6: Commit**

```bash
git add src/tools/ src/index.ts
git commit -m "feat: wire all MCP tools into server entry point"
```

---

### Task 19: Update README

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Write README**

```markdown
# skill-finder

An MCP server that discovers and installs skills, agents, commands, prompts, hooks, and instructions from remote Git repositories (GitHub and GitLab) without cloning them.

## Setup

```json
{
  "mcpServers": {
    "skill-finder": {
      "command": "node",
      "args": ["/path/to/skill-finder/dist/index.js"]
    }
  }
}
```

## Tools

| Tool | Description |
|---|---|
| `add_library` | Register a GitHub/GitLab repo as a source |
| `remove_library` | Remove a registered library |
| `list_libraries` | List all registered libraries |
| `refresh_index` | Re-crawl libraries to pick up new assets |
| `search` | Search across all libraries by name, tag, or description |
| `install` | Install any asset (auto-detects type) |
| `install_skill` | Install a skill to `.claude/skills/` |
| `install_agent` | Install an agent to `.claude/agents/` or `.github/agents/` |
| `install_command` | Install a command to `.claude/commands/` |
| `install_prompt` | Install a prompt to `.github/prompts/` |
| `install_hook` | Install a hook to `.claude/hooks/` |
| `install_instruction` | Append an instruction to `CLAUDE.md` or `AGENTS.md` |

## Usage

```
add_library url="https://github.com/org/my-skills"
search query="test driven development" type="skill"
install_skill repo="my-skills" path="skills/tdd/SKILL.md"
```

## Config

Libraries are stored in `~/.skill-finder/libraries.json` (created with `0600` permissions). Tokens are stored in plaintext — treat this file like an SSH key.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add README with setup and tool reference"
```
