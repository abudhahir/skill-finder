// src/tools/library-tools.ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig, addLibrary, removeLibrary } from '../config/config.js'
import { refreshLibrary, clearCache } from '../discovery/session-cache.js'

export function registerLibraryTools(server: McpServer): void {
  server.registerTool(
    'add_library',
    {
      description: 'Register a Git repository as a skill library source',
      inputSchema: z.object({
        url: z.string().describe('Full HTTPS URL to the repository'),
        branch: z.string().optional().describe('Branch name (defaults to repo default)'),
        token: z.string().optional().describe('Personal access token for private repos'),
        name: z.string().optional().describe('Human-readable name (defaults to repo slug)'),
        root: z.string().optional().describe('Subdirectory to narrow crawl scope'),
      }),
    },
    async (params) => {
      await addLibrary(params)
      return { content: [{ type: 'text', text: `Library added: ${params.name ?? params.url}` }] }
    }
  )

  server.registerTool(
    'remove_library',
    {
      description: 'Remove a registered library by name',
      inputSchema: z.object({
        name: z.string().describe('Library name to remove'),
      }),
    },
    async ({ name }) => {
      try {
        await removeLibrary(name)
        return { content: [{ type: 'text', text: `Library "${name}" removed` }] }
      } catch (e) {
        return { content: [{ type: 'text', text: (e as Error).message }], isError: true }
      }
    }
  )

  server.registerTool(
    'list_libraries',
    {
      description: 'List all registered libraries',
      inputSchema: z.object({}),
    },
    async () => {
      const config = await loadConfig()
      const redacted = config.libraries.map((l) => ({
        ...l,
        token: l.token ? '***' : undefined,
      }))
      return { content: [{ type: 'text', text: JSON.stringify(redacted, null, 2) }] }
    }
  )

  server.registerTool(
    'refresh_index',
    {
      description: 'Re-crawl one or all libraries to refresh the session index',
      inputSchema: z.object({
        library: z.string().optional().describe('Library name to refresh (omit for all)'),
      }),
    },
    async ({ library }) => {
      const config = await loadConfig()
      const targets = library
        ? config.libraries.filter((l) => l.name === library)
        : config.libraries

      if (library && targets.length === 0) {
        return { content: [{ type: 'text', text: `Library "${library}" not found` }], isError: true }
      }

      clearCache(library)
      const summary: Array<{ library: string; assetCount: number; byType: Record<string, number> }> = []

      for (const lib of targets) {
        const records = await refreshLibrary(lib)
        const byType: Record<string, number> = {}
        for (const r of records) {
          byType[r.type] = (byType[r.type] ?? 0) + 1
        }
        summary.push({ library: lib.name, assetCount: records.length, byType })
      }

      return { content: [{ type: 'text', text: JSON.stringify(summary, null, 2) }] }
    }
  )
}
