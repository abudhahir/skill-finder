// src/index.ts
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { registerLibraryTools } from './tools/library-tools.js'
import { registerSearchTool } from './tools/search-tool.js'
import { registerInstallTools } from './tools/install-tools.js'

export const server = new McpServer({
  name: 'spark',
  version: '0.1.0',
})

registerLibraryTools(server)
registerSearchTool(server)
registerInstallTools(server)

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('spark MCP server running on stdio')
}

main().catch((error) => {
  console.error('Fatal error:', error)
  process.exit(1)
})
