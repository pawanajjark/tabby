# Tabby Instamart MCP

An isolated developer integration for Swiggy Instamart's 19-tool MCP server. It provides:

- a local MCP proxy so Tabby agents can discover and call every upstream Instamart tool;
- a deterministic recipe-to-cart agent for address selection, product matching, pack sizing, coupons, and payment-method selection;
- a small HTTP bridge used by Tabby's recipe cards;
- a seeded local developer stub, with a staging switch for Swiggy's developer endpoint.

## Run the local developer flow

From the Tabby project root, run `npm install` once and then `npm run dev`. The parent command starts both Vite and this bridge automatically. The local stub never places a real order.

Open `http://127.0.0.1:8787` for the standalone MCP chat. It supports all tools through direct commands:

```text
/tool get_addresses {}
/tool search_products {"addressId":"dev-home","query":"tomatoes"}
```

Set `OPENAI_API_KEY` to enable unrestricted conversational routing through the OpenAI Responses API. The default is `gpt-5.5` with medium reasoning; override it with `OPENAI_MODEL` if needed. Shopping commands still run through the deterministic state machine first, so product IDs, pack quantities, cart writes, and checkout confirmation do not depend on model memory. Without an API key, direct commands plus the deterministic shopping flow continue to work.

## Persist shopping-agent state in SpacetimeDB

The Tabby module now includes an owner-scoped `shopping_agent_state` table and the `my_shopping_agent_states` view. It stores the workflow phase, requested items, selected Instamart SKU IDs, cart/payment snapshots, recent tool evidence, and the pending-confirmation flag. No payment credentials are stored.

The table, view, and reducers are published to Tabby's existing Maincloud database. The safe publish form is:

```powershell
spacetime publish tabby --module-path ../spacetimedb --server maincloud --delete-data=never
$env:OPENAI_MODEL='gpt-5.5'
npm run dev
```

Do not republish the entire current development module until its other pending schema changes are reconciled with Maincloud. The Instamart deployment was intentionally made from the hosted-compatible Tabby module baseline so it added only `shopping_agent_state` and did not alter or delete existing tables.

Tabby hydrates the bridge from its owner-scoped `my_shopping_agent_states` view and writes the returned state through the web app's existing authenticated `DbConnection`. The bridge deliberately does not open a second database socket. Reducers enforce the same owner and active-home permissions as the rest of the application, and the table participates in Tabby's normal realtime household subscription.

Standalone chat uses process-local state because it does not own Tabby's authenticated browser connection. `GET /health` reports that state synchronization is owned by Tabby.

## Use Swiggy staging

Set these variables before starting the bridge:

```powershell
$env:INSTAMART_MODE='staging'
$env:SWIGGY_MCP_URL='https://mcp-staging.swiggy.com/im'
$env:SWIGGY_ACCESS_TOKEN='<OAuth access token>'
npm run dev
```

Swiggy uses OAuth 2.1 with PKCE, not API keys. Tokens should be kept in memory or a secure secret store and never committed. The staging service is backed by seeded data and does not create real orders.

## Add all Instamart tools to an MCP client

```json
{
  "mcpServers": {
    "tabby-instamart": {
      "command": "npm",
      "args": ["--prefix", "E:/Code/tabby/instamart-mcp", "run", "mcp"]
    }
  }
}
```

The proxy mirrors the upstream `tools/list` response. It adds one required local argument to `checkout`: `confirmedByUser: true`. This enforces Swiggy's requirement that the refreshed cart, payment method, and delivery address be shown and explicitly confirmed before checkout.

## HTTP API

- `GET /health`
- `GET /api/tools`
- `POST /api/tools/:name` — generic access to all 19 tools
- `POST /api/recipe-cart` — autonomous recipe-item matching through checkout review
- `POST /api/recipe-checkout` — one-click developer recipe matching and confirmed checkout
- `POST /api/checkout` — requires `{ "sessionId": "...", "confirmed": true }`

The CORS policy permits Tabby's local Vite origins on `localhost` or `127.0.0.1`.
