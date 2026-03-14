#!/usr/bin/env node
/**
 * Installs skill-finder into Claude Desktop, Claude Code, and VS Code (GitHub Copilot).
 *
 * Usage:
 *   node scripts/install-mcp.mjs
 *   node scripts/install-mcp.mjs --local   # use local build instead of npx
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { join, dirname, resolve } from 'node:path'
import { homedir } from 'node:os'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const home = homedir()
const isWindows = process.platform === 'win32'
const isMac = process.platform === 'darwin'
const useLocal = process.argv.includes('--local')

// Server command: npx (default) or local build
const serverConfig = useLocal
  ? { command: 'node', args: [resolve(__dirname, '..', 'dist', 'index.js')] }
  : { command: 'npx', args: ['-y', 'skill-finder'] }

// Config file locations per platform
function claudeDesktopPath() {
  if (isWindows) return join(process.env.APPDATA ?? '', 'Claude', 'claude_desktop_config.json')
  if (isMac) return join(home, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json')
  return join(home, '.config', 'Claude', 'claude_desktop_config.json')
}

function claudeCodePath() {
  return join(home, '.claude', 'settings.json')
}

function vscodePath() {
  if (isWindows) return join(process.env.APPDATA ?? '', 'Code', 'User', 'settings.json')
  if (isMac) return join(home, 'Library', 'Application Support', 'Code', 'User', 'settings.json')
  return join(home, '.config', 'Code', 'User', 'settings.json')
}

// Read JSON safely (returns null on parse error, {} if file missing)
function readJson(path) {
  if (!existsSync(path)) return {}
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    console.warn(`  ⚠ Could not parse ${path} — skipping (fix JSON errors manually)`)
    return null
  }
}

function writeJson(path, data) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, JSON.stringify(data, null, 2) + '\n', 'utf-8')
}

const targets = [
  {
    name: 'Claude Desktop',
    path: claudeDesktopPath(),
    install(config) {
      config.mcpServers ??= {}
      const existing = config.mcpServers['skill-finder']
      config.mcpServers['skill-finder'] = serverConfig
      return existing ? 'updated' : 'added'
    },
  },
  {
    name: 'Claude Code',
    path: claudeCodePath(),
    install(config) {
      config.mcpServers ??= {}
      const existing = config.mcpServers['skill-finder']
      config.mcpServers['skill-finder'] = serverConfig
      return existing ? 'updated' : 'added'
    },
  },
  {
    name: 'VS Code (GitHub Copilot)',
    path: vscodePath(),
    install(config) {
      config.mcp ??= {}
      config.mcp.servers ??= {}
      const existing = config.mcp.servers['skill-finder']
      config.mcp.servers['skill-finder'] = { type: 'stdio', ...serverConfig }
      return existing ? 'updated' : 'added'
    },
  },
]

console.log(`\nskill-finder MCP installer`)
console.log(`Mode: ${useLocal ? 'local build (dist/index.js)' : 'npx skill-finder'}\n`)

let installed = 0
for (const target of targets) {
  process.stdout.write(`${target.name}\n  ${target.path}\n`)
  const config = readJson(target.path)
  if (config === null) continue // parse error, already warned

  const status = target.install(config)
  writeJson(target.path, config)
  console.log(`  ✓ ${status}\n`)
  installed++
}

if (installed > 0) {
  console.log(`Installed to ${installed}/${targets.length} targets.`)
  console.log('Restart Claude Desktop and/or reload VS Code to pick up the changes.\n')
} else {
  console.log('Nothing was installed. Check the warnings above.\n')
}
