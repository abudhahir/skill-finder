// src/installer/install-prompt.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'
import { resolveDestinationBase } from './file-routing.js'

export async function installPrompt(
  asset: AssetRecord, repo: LibraryConfig, provider: Provider, cwd: string, targetDir?: string
): Promise<InstallResult> {
  const base = targetDir ?? join(cwd, '.github', 'prompts')
  await mkdir(base, { recursive: true })
  const written: string[] = []
  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const destinationBase = resolveDestinationBase(cwd, targetDir, filePath, base, asset.platform)
    await mkdir(destinationBase, { recursive: true })
    const dest = join(destinationBase, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }
  return { written, message: `Installed prompt "${asset.name}" to ${base}` }
}
