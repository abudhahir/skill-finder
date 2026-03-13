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

const VALID_TYPES = new Set(['skill', 'agent', 'command', 'prompt', 'hook', 'instruction'])
const VALID_PLATFORMS = new Set(['claude-code', 'copilot', 'unknown'])

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
    if (!VALID_TYPES.has(entry.type as string)) return null

    const files = entry.files as string[]
    records.push({
      name: entry.name,
      description: typeof entry.description === 'string' ? entry.description : '',
      tags: Array.isArray(entry.tags) ? entry.tags as string[] : [],
      type: entry.type as AssetType,
      platform: typeof entry.platform === 'string' && VALID_PLATFORMS.has(entry.platform) ? entry.platform as Platform : 'unknown',
      repo: repoName,
      path: files[0]!,
      files,
    })
  }
  return records
}
