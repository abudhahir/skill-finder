// src/types.ts

export type AssetType = 'skill' | 'agent' | 'command' | 'prompt' | 'hook' | 'instruction'
export type Platform = 'claude-code' | 'copilot' | 'unknown'

export interface LibraryConfig {
  name: string
  url: string
  branch?: string
  token?: string
  root?: string
}

export interface TreeEntry {
  path: string
  type: 'blob' | 'tree'
}

export interface AssetRecord {
  name: string
  description: string
  tags: string[]
  type: AssetType
  platform: Platform
  repo: string
  path: string
  files: string[]
}

export interface Provider {
  resolveDefaultBranch(repo: LibraryConfig): Promise<string>
  listTree(repo: LibraryConfig): Promise<TreeEntry[]>
  fetchFile(repo: LibraryConfig, path: string): Promise<string>
}

export interface InstallParams {
  repo: string
  path: string
  platform?: Platform
  targetDir?: string
}

export interface InstallResult {
  written: string[]
  message: string
}
