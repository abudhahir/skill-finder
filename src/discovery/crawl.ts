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
