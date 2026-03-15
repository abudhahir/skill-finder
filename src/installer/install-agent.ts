// src/installer/install-agent.ts
import { mkdir, writeFile } from 'node:fs/promises'
import { join, basename } from 'node:path'
import type { AssetRecord, InstallResult, LibraryConfig, Provider } from '../types.js'
import { resolveDestinationBase } from './file-routing.js'

export async function installAgent(
  asset: AssetRecord,
  repo: LibraryConfig,
  provider: Provider,
  cwd: string,
  targetDir?: string
): Promise<InstallResult> {
  if (asset.platform === 'unknown') {
    return { written: [], message: 'Please specify a platform: "claude-code" or "copilot"' }
  }

  const base = targetDir ?? (
    asset.platform === 'claude-code'
      ? join(cwd, '.claude', 'agents')
      : join(cwd, '.github', 'agents')
  )

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

  return { written, message: `Installed agent "${asset.name}" to ${base}` }
}
