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
