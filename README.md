# Tabby

Tabby is a shared household workspace. Three focused agents turn live pantry data and roommate preferences into restock plans, meal suggestions, and fair itemized expense splits.

## How SpacetimeDB powers Tabby

SpacetimeDB is the only shared backend. Its public tables (`member`, `pantry_item`, `expense`, `expense_split`, and `chat_message`) are subscribed to by every browser. Reducers are transactional commands: a pantry update or an expense plus all of its splits either succeeds together or changes nothing.

The shopping and cooking agents work with a deterministic local planning engine and can use OpenAI for generated recommendations when configured. The billing agent parses itemized text without an API key and uses OpenAI vision for receipt images. Chat routes supported household requests to the same underlying actions.

## Run Tabby

```bash
npm install
npm run dev
```

The root package contains the Instamart runtime under `server/instamart`. `npm run dev` starts the Vite application, and the same parent origin serves the Instamart `/api/recipe-cart`, `/api/checkout`, and `/api/order-status` routes directly in development. No second terminal or separate Instamart startup command is needed for the normal workflow.

Open the Vite address shown in the terminal. By default it connects to the cloud-hosted `tabby` database at Maincloud, so other people can share the same household state. Open it in multiple tabs to see realtime synchronization.

Tabby is installable as a PWA from a supported browser. The app shell opens offline and retains the existing local conversation state; shared pantry and household actions remain paused until the SpacetimeDB connection returns. PWA installation and service workers require HTTPS in production (localhost is allowed during development).

## Deploy to Vercel

Vercel automatically hosts the TypeScript functions in `api/`. Leave `VITE_INSTAMART_BRIDGE_URL` unset so the production browser calls the same deployment's `/api/recipe-cart`, `/api/checkout`, and `/api/order-status` routes. The hosted functions use the seeded catalogue by default and restore each cart from Tabby's synchronized shopping state between function invocations.

To connect a Vercel environment to Swiggy's staging MCP instead, configure `INSTAMART_MODE=staging`, `SWIGGY_MCP_URL`, and `SWIGGY_ACCESS_TOKEN` as server-side Vercel environment variables. Do not expose the access token through a `VITE_` variable.

For local backend work instead, run `spacetime start`, use `spacetime dev tabby --server local --yes` to rebuild/publish/regenerate bindings, and set `VITE_SPACETIMEDB_URI=ws://localhost:3000` for the frontend.

## Chat commands

- `I bought 10 eggs`
- `I bought 2 kg rice`
- `Electricity bill INR 2400`
- `What can we cook?`
- `Refresh the shopping plan`

Open **My profile** to add dietary preferences and cooking habits. Receipt text should contain one priced item per line, for example `Rice - 450`.
