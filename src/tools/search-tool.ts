// src/tools/search-tool.ts
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { loadConfig } from '../config/config.js'
import { getOrPopulate, warnings } from '../discovery/session-cache.js'
import { searchAssets } from '../search/search.js'

export function registerSearchTool(server: McpServer): void {
  server.registerTool(
    'search',
    {
      description: 'Search for skills, agents, commands, prompts, hooks, or instructions across all registered libraries',
      inputSchema: z.object({
        query: z.string().describe('Search query — matched against name, tags, and description'),
        type: z.enum(['skill', 'agent', 'command', 'prompt', 'hook', 'instruction']).optional(),
        library: z.string().optional().describe('Limit search to a specific library name'),
        platform: z.enum(['claude-code', 'copilot']).optional(),
        limit: z.number().int().positive().default(20).describe('Maximum results to return'),
      }),
    },
    async (params) => {
      const config = await loadConfig()
      if (config.libraries.length === 0) {
        return { content: [{ type: 'text', text: 'No libraries registered. Use add_library to add one.' }] }
      }

      const records = await getOrPopulate(config.libraries)
      const results = searchAssets(records, params)
      const response = {
        results,
        warnings: warnings.length > 0 ? warnings : undefined,
        hint: 'Pass asset.repo and asset.path to any install tool to install an asset.',
      }
      return { content: [{ type: 'text', text: JSON.stringify(response, null, 2) }] }
    }
  )
}
