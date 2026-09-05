# Tabby

Tabby is a shared household workspace. Three focused agents turn live pantry data and roommate preferences into restock plans, meal suggestions, and fair itemized expense splits.

## How SpacetimeDB powers Tabby

SpacetimeDB is the only shared backend. Its public tables (`member`, `pantry_item`, `expense`, `expense_split`, and `chat_message`) are subscribed to by every browser. Reducers are transactional commands: a pantry update or an expense plus all of its splits either succeeds together or changes nothing.

The shopping and cooking agents work with a deterministic local planning engine and can use OpenAI for generated recommendations when configured. The billing agent parses itemized text without an API key and uses OpenAI vision for receipt images. Chat routes supported household requests to the same underlying actions.

## Run Tabby

```bash
npm install
npm run dev -- --host 0.0.0.0
```

Open the Vite address shown in the terminal. By default it connects to the cloud-hosted `tabby` database at Maincloud, so other people can share the same household state. Open it in multiple tabs to see realtime synchronization.

For local backend work instead, run `spacetime start`, use `spacetime dev tabby --server local --yes` to rebuild/publish/regenerate bindings, and set `VITE_SPACETIMEDB_URI=ws://localhost:3000` for the frontend.

## Chat commands

- `I bought 10 eggs`
- `I bought 2 kg rice`
- `Electricity bill INR 2400`
- `What can we cook?`
- `Refresh the shopping plan`

Open **My profile** to add dietary preferences and cooking habits. Receipt text should contain one priced item per line, for example `Rice - 450`.
