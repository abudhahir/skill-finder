// src/installer/install-skill.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'

export async function installSkill(
  asset: AssetRecord,
  repo: LibraryConfig,
  provider: Provider,
  cwd: string,
  targetDir?: string
): Promise<InstallResult> {
  // Derive dir name from the path component containing SKILL.md
  const dirName = asset.path.split('/').slice(-2, -1)[0] ?? asset.name
  const base = targetDir ? join(targetDir, dirName) : join(cwd, '.claude', 'skills', dirName)
  const isUpdate = existsSync(base)

  await mkdir(base, { recursive: true })
  const written: string[] = []

  for (const filePath of asset.files) {
    const content = await provider.fetchFile(repo, filePath)
    const dest = join(base, basename(filePath))
    await writeFile(dest, content, 'utf-8')
    written.push(dest)
  }

  return {
    written,
    message: isUpdate
      ? `Updated skill "${asset.name}" in ${base}`
      : `Installed skill "${asset.name}" to ${base}`,
  }
}
