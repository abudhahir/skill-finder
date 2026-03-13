// src/providers/registry.ts
import type { Provider } from '../types.js'
import { GitHubProvider } from './github.js'
import { GitLabProvider } from './gitlab.js'

export function getProvider(url: string): Provider {
  const hostname = new URL(url).hostname
  if (hostname === 'github.com') return new GitHubProvider()
  if (hostname === 'gitlab.com' || hostname.endsWith('.gitlab.com')) return new GitLabProvider()
  throw new Error(`Unsupported provider hostname: "${hostname}". Supported: github.com, gitlab.com`)
}
