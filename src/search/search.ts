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
