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
