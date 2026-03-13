// src/discovery/session-cache.ts
import type { AssetRecord, LibraryConfig } from '../types.js'
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
