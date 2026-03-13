// src/installer/install-hook.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installHook(
  asset: AssetRecord, repo: LibraryConfig, provider: Provider, cwd: string, targetDir?: string
): Promise<InstallResult> {
  const base = targetDir ?? join(cwd, '.claude', 'hooks')
  await mkdir(base, { recursive: true })
  const written: string[] = []
  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }
  return { written, message: `Installed hook "${asset.name}" to ${base}` }
}
