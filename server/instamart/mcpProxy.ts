// Root-project stdio entrypoint exposing the complete Instamart tool catalogue.
import 'dotenv/config';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { createInstamartClient } from './clientFactory.js';
import { unwrapToolResult } from './toolResult.js';

const upstream = createInstamartClient();
const server = new Server({ name: 'tabby-instamart-proxy', version: '0.1.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => {
  const tools = await upstream.listTools();
  return {
    tools: tools.map(tool => tool.name === 'checkout' ? {
      ...tool,
      description: `${tool.description || ''}\nRequires explicit confirmation after displaying a refreshed cart, payment method, and delivery address.`,
      inputSchema: addConfirmation(tool.inputSchema),
    } : tool),
  };
});

server.setRequestHandler(CallToolRequestSchema, async request => {
  const args = { ...(request.params.arguments || {}) } as Record<string, unknown>;
  if (request.params.name === 'checkout') {
    if (args.confirmedByUser !== true) throw new Error('checkout requires confirmedByUser=true after explicit user confirmation.');
    delete args.confirmedByUser;
  }
  const result = unwrapToolResult(await upstream.callTool(request.params.name, args));
  return { content: [{ type: 'text', text: JSON.stringify(result) }] };
});

function addConfirmation(schema: Record<string, unknown>): Record<string, unknown> {
  const properties = { ...((schema.properties as Record<string, unknown> | undefined) || {}), confirmedByUser: { type: 'boolean', const: true, description: 'True only after the user explicitly confirms the refreshed order summary.' } };
  const required = Array.from(new Set([...(Array.isArray(schema.required) ? schema.required as string[] : []), 'confirmedByUser']));
  return { ...schema, type: 'object', properties, required };
}

await server.connect(new StdioServerTransport());

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await upstream.close?.();
    await server.close();
    process.exit(0);
  });
}
