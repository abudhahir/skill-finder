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
  const home = process.env['HOME'] ?? process.env['USERPROFILE'] ?? homedir()
  return join(home, '.skill-finder', 'libraries.json')
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
