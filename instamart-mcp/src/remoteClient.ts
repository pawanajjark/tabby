import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { McpToolDefinition, ToolClient } from './types.js';

export class SwiggyRemoteClient implements ToolClient {
  private readonly client = new Client({ name: 'tabby-instamart', version: '0.1.0' });
  private connected = false;

  constructor(
    private readonly endpoint: string,
    private readonly accessToken: string,
  ) {}

  private async connect(): Promise<void> {
    if (this.connected) return;
    if (!this.accessToken) {
      throw new Error('SWIGGY_ACCESS_TOKEN is required in staging mode. Complete Swiggy OAuth 2.1 PKCE first.');
    }
    const transport = new StreamableHTTPClientTransport(new URL(this.endpoint), {
      requestInit: { headers: { Authorization: `Bearer ${this.accessToken}` } },
    });
    await this.client.connect(transport);
    this.connected = true;
  }

  async listTools(): Promise<McpToolDefinition[]> {
    await this.connect();
    const response = await this.client.listTools();
    return response.tools.map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema as Record<string, unknown>,
    }));
  }

  async callTool(name: string, arguments_: Record<string, unknown>): Promise<unknown> {
    await this.connect();
    return this.client.callTool({ name, arguments: arguments_ });
  }

  async close(): Promise<void> {
    if (this.connected) await this.client.close();
    this.connected = false;
  }
}
