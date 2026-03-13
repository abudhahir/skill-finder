// tests/config/config.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdirSync, existsSync, statSync } from 'node:fs'
import { rm } from 'node:fs/promises'
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

afterEach(async () => {
  process.env['HOME'] = originalHome
  await rm(testDir, { recursive: true, force: true })
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
