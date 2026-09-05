import { MockInstamartClient } from './mockClient.js';
import { SwiggyRemoteClient } from './remoteClient.js';
import type { ToolClient } from './types.js';

export function createInstamartClient(env = process.env): ToolClient {
  const mode = (env.INSTAMART_MODE || 'mock').toLowerCase();
  if (mode === 'mock') return new MockInstamartClient();
  const endpoint = env.SWIGGY_MCP_URL || 'https://mcp-staging.swiggy.com/im';
  if (!endpoint.includes('mcp-staging.swiggy.com') && env.ALLOW_PRODUCTION_INSTAMART !== 'true') {
    throw new Error('Only the Swiggy staging endpoint is allowed. Set ALLOW_PRODUCTION_INSTAMART=true to opt in explicitly.');
  }
  return new SwiggyRemoteClient(endpoint, env.SWIGGY_ACCESS_TOKEN || '');
}
